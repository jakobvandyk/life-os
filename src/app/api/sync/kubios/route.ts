// Kubios Cloud API sync endpoint — scaffold only, not yet active.
// Docs: https://www.kubios.com/hrv-api/
//
// Intended flow when activated:
// 1. Authenticate with Kubios Cloud API using OAuth 2.0 client credentials
//    POST https://kubioscloud.auth.eu-west-1.amazoncognito.com/oauth2/token
//    grant_type=client_credentials, client_id=KUBIOS_CLIENT_ID, client_secret=KUBIOS_CLIENT_SECRET
// 2. Fetch latest HRV result:
//    GET https://analysis.kubioscloud.com/v2/result/self?from=<yesterday>&to=<today>
//    Authorization: Bearer <access_token>
// 3. Extract from response: rmssd, pns_index, sns_index, stress_index, readiness_score, mean_hr_bpm
// 4. Upsert to workout_checkins using getServiceClient() (service role, bypasses RLS)
//    Match on (user_id, date) with onConflict
// 5. Log to integration_syncs with source "kubios"
//
// Env vars needed: KUBIOS_CLIENT_ID, KUBIOS_CLIENT_SECRET
// HEALTH_USER_ID is reused for the single-user system.

export async function GET(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    status: "not_implemented",
    message: "Kubios sync endpoint — activate when OAuth credentials are configured",
  });
}
