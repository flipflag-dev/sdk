import { FlipFlag } from 'src/provider';
import {
  IDeclareFeatureOptions,
  IFeatureFlag,
  IManagerOptions,
} from 'src/types/provider';

describe('FlipFlag', () => {
  let fetchMock: jest.Mock;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    // эмулируем window в Jest (если среда node)
    (global as any).window = {
      location: {
        origin: 'https://test.local',
      },
    };

    jest.clearAllMocks();
  });

  const createManager = (opts: Partial<IManagerOptions> = {}) => {
    const options: IManagerOptions = {
      publicKey: 'public-key',
      privateKey: 'private-key',
      apiUrl: 'https://api.flipflag.dev',
      ...opts,
    } as IManagerOptions;

    return new FlipFlag(options);
  };

  test('init загружает фичи и запускает интервал', async () => {
    const manager = createManager();

    const serverFlags: Record<string, IFeatureFlag> = {
      featureA: { enabled: true } as any,
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(serverFlags),
    });

    await manager.init();

    // 1 вызов fetch при init
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://test.local/v1/sdk/feature?publicKey=public-key',
      expect.objectContaining({
        method: 'GET',
      })
    );

    // флаг должен быть в локальном кеше
    expect(manager.isEnabled('featureA')).toBe(true);

    // интервал запустился — промотаем время и проверим, что fetch вызывается снова
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(serverFlags),
    });

    jest.advanceTimersByTime(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('init кидает ошибку, если нет publicKey', async () => {
    const manager = createManager({ publicKey: undefined as any });

    await expect(manager.init()).rejects.toThrow(
      'Public key is missing. Please provide a valid publicKey in the SDK configuration.'
    );
  });

  test('init кидает ошибку при неуспешном ответе сервера (первичная загрузка)', async () => {
    const manager = createManager();

    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal error'),
    });

    await expect(manager.init()).rejects.toThrow(
      'Failed to get features: 500 - Internal error'
    );
  });

  test('isEnabled возвращает true при включённом флаге', () => {
    const manager = createManager();
    const anyManager = manager as any;

    anyManager.featuresFlags = {
      featureA: { enabled: true } as IFeatureFlag,
    };

    expect(manager.isEnabled('featureA')).toBe(true);
  });

  test('isEnabled возвращает false и создаёт фичу на сервере, если её нет локально и есть privateKey', () => {
    const manager = createManager();
    const anyManager = manager as any;

    // нет такого флага
    anyManager.featuresFlags = {};

    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });

    const enabled = manager.isEnabled('newFeature');

    expect(enabled).toBe(false);
    // createFeature делает POST на /v1/sdk/feature
    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/sdk/feature',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureName: 'newFeature',
          privateKey: 'private-key',
          times: [],
        }),
      })
    );
  });

  test('isEnabled не делает запрос на создание, если нет privateKey', () => {
    const manager = createManager({ privateKey: undefined as any });
    const anyManager = manager as any;

    anyManager.featuresFlags = {};

    const enabled = manager.isEnabled('someFeature');

    expect(enabled).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('declareFeature сохраняет опции во внутреннем кеше и syncFeaturesTimes отправляет их на сервер', async () => {
    const manager = createManager();
    const anyManager = manager as any;

    const options: IDeclareFeatureOptions = {
      times: [{ startAt: 1, endAt: 2 }] as any,
    };

    manager.declareFeature('myFeature', options);

    expect(anyManager.featuresTimes['myFeature']).toBe(options);

    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });

    await anyManager.syncFeaturesTimes();

    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/sdk/feature',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureName: 'myFeature',
          privateKey: 'private-key',
          times: options.times,
        }),
      })
    );
  });

  test('syncFeaturesTimes возвращает null и не вызывает fetch, если нет privateKey', async () => {
    const manager = createManager({ privateKey: undefined as any });
    const anyManager = manager as any;

    manager.declareFeature('myFeature', { times: [] } as any);

    const result = await anyManager.syncFeaturesTimes();

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('destroy останавливает интервал и очищает кеши', async () => {
    const manager = createManager();
    const anyManager = manager as any;

    const serverFlags: Record<string, IFeatureFlag> = {
      featureA: { enabled: true } as any,
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(serverFlags),
    });

    await manager.init();

    manager.declareFeature('myFeature', { times: [] } as any);

    expect(anyManager.featuresFlags).toEqual(serverFlags);
    expect(anyManager.featuresTimes).toHaveProperty('myFeature');

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval' as any);

    manager.destroy();

    expect(anyManager.inited).toBe(false);
    expect(anyManager.featuresFlags).toEqual({});
    expect(anyManager.featuresTimes).toEqual({});
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  test('getFeaturesFlags обновляет локальный кеш флагов (через приватный метод)', async () => {
    const manager = createManager();
    const anyManager = manager as any;

    const serverFlags: Record<string, IFeatureFlag> = {
      f1: { enabled: true } as any,
      f2: { enabled: false } as any,
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(serverFlags),
    });

    await anyManager.getFeaturesFlags();

    expect(anyManager.featuresFlags).toEqual(serverFlags);
  });
});
