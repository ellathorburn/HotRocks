import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockInvoke = jest.fn<() => Promise<unknown>>();
const mockRequestSync = jest.fn<() => Promise<void>>();
const mockMarkPosting = jest.fn();
const mockMarkPosted = jest.fn();
const mockMarkFailed = jest.fn();

jest.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => ({ functions: { invoke: mockInvoke } }),
}));

jest.mock('@/services/sync/sync-engine', () => ({ requestSync: mockRequestSync }));

jest.mock('@/features/strava/storage/strava-export-storage', () => ({
  stravaExportStorage: {
    markPosting: mockMarkPosting,
    markPosted: mockMarkPosted,
    markFailed: mockMarkFailed,
  },
}));

const {
  stravaExportService,
  StravaPostError,
} = require('../src/features/strava/services/strava-export-service');
const { calculateIntervalTotals } = require('../src/features/sessions/services/session-calculation-service');

const totals = calculateIntervalTotals(
  [
    { id: 'a', kind: 'heat', durationSeconds: 900, temperatureCTenths: 920 },
    { id: 'b', kind: 'cold', durationSeconds: 120, temperatureCTenths: 110 },
  ],
  1500,
);

const input = {
  sessionId: 'session-1',
  userId: 'user-1',
  venueName: 'Sea Point Pavilion',
  totals,
  note: null,
  temperatureUnit: 'celsius' as const,
};

/**
 * supabase-js reports a non-2xx by putting the raw Response on
 * `error.context`, not by parsing it into `data`. Failures are built that way
 * here, because a mock that puts the code in `data` cannot catch the bug this
 * covers.
 */
function httpFailure(status: number, body: unknown) {
  const error = new Error(`Edge Function returned a non-2xx status code`) as Error & {
    context: Response;
  };
  error.context = new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  return { data: null, error };
}

async function expectFailure(reason: string) {
  await expect(stravaExportService.post(input)).rejects.toBeInstanceOf(StravaPostError);
  try {
    await stravaExportService.post(input);
    throw new Error('post resolved when it should have thrown');
  } catch (error) {
    expect((error as { reason: string }).reason).toBe(reason);
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestSync.mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('posting a session to Strava', () => {
  test('sends the rendered activity text and records the activity id', async () => {
    mockInvoke.mockResolvedValue({ data: { stravaActivityId: 555, postedAt: '2026-09-29T10:00:00.000Z' }, error: null });

    const activityId = await stravaExportService.post(input);

    expect(activityId).toBe(555);
    const [functionName, options] = mockInvoke.mock.calls[0] as unknown as [
      string,
      { body: Record<string, unknown> },
    ];
    expect(functionName).toBe('post-to-strava');
    expect(options.body).toMatchObject({
      sessionId: 'session-1',
      name: 'Sauna & cold plunge at Sea Point Pavilion',
      sportType: 'Workout',
    });
    expect(mockMarkPosted).toHaveBeenCalledWith('session-1', 'user-1', 555, '2026-09-29T10:00:00.000Z');
  });

  test('pushes queued work first, because the server reads the synced session', async () => {
    mockInvoke.mockResolvedValue({ data: { stravaActivityId: 1 }, error: null });

    await stravaExportService.post(input);

    expect(mockRequestSync).toHaveBeenCalledWith('user-1');
    expect(mockMarkPosting).toHaveBeenCalledWith('session-1', 'user-1');
  });

  test('a missing connection is reported as such, not as an unknown failure', async () => {
    mockInvoke.mockResolvedValue(httpFailure(409, { code: 'not_connected' }));

    await expectFailure('not_connected');
    expect(mockMarkFailed).toHaveBeenCalledWith('session-1', 'user-1', 'not_connected');
  });

  test('a missing scope is distinguished from a missing connection', async () => {
    mockInvoke.mockResolvedValue(httpFailure(409, { code: 'missing_scope' }));
    await expectFailure('missing_scope');
  });

  test('an unsynced session is reported as not yet uploaded', async () => {
    mockInvoke.mockResolvedValue(httpFailure(404, { code: 'session_not_found' }));
    await expectFailure('not_synced');
  });

  test('Strava refusing the activity is its own reason', async () => {
    mockInvoke.mockResolvedValue(httpFailure(502, { code: 'strava_rejected' }));
    await expectFailure('strava_rejected');
  });

  test('a function that is not deployed is not reported as a Strava problem', async () => {
    mockInvoke.mockResolvedValue(httpFailure(404, { message: 'Requested function was not found' }));
    await expectFailure('not_deployed');
  });

  test('a server fault is reported as a server fault', async () => {
    mockInvoke.mockResolvedValue(httpFailure(500, { message: 'boom' }));
    await expectFailure('server_error');
  });

  test('an unparseable error body still yields a reason from the status', async () => {
    const error = new Error('non-2xx') as Error & { context: Response };
    error.context = new Response('<html>gateway</html>', { status: 503 });
    mockInvoke.mockResolvedValue({ data: null, error });

    await expectFailure('server_error');
  });

  test('a network failure with no response is reported as offline', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Network request failed') });
    await expectFailure('offline');
  });

  test('a thrown network error is reported as offline', async () => {
    mockInvoke.mockRejectedValue(new Error('Network request failed'));
    await expectFailure('offline');
  });

  test('a success shaped without an activity id is not treated as posted', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });

    await expectFailure('unknown');
    expect(mockMarkPosted).not.toHaveBeenCalled();
    expect(mockMarkFailed).toHaveBeenCalledWith('session-1', 'user-1', 'missing_activity_id');
  });
});
