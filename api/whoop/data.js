const { getValidAccessToken, whoopGet } = require("../../lib/whoop");

// Read-only endpoint the frontend polls to render the WHOOP box. Never
// exposes tokens — just the handful of numbers the UI needs.
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      res.status(200).json({ connected: false });
      return;
    }

    const [recovery, sleep] = await Promise.all([
      whoopGet("/v2/recovery?limit=1", accessToken),
      whoopGet("/v2/activity/sleep?limit=1", accessToken),
    ]);

    const recoveryRecord = recovery.records && recovery.records[0];
    const sleepRecord = sleep.records && sleep.records[0];

    res.status(200).json({
      connected: true,
      recoveryScore: (recoveryRecord && recoveryRecord.score && recoveryRecord.score.recovery_score) ?? null,
      restingHeartRate: (recoveryRecord && recoveryRecord.score && recoveryRecord.score.resting_heart_rate) ?? null,
      hrv: (recoveryRecord && recoveryRecord.score && recoveryRecord.score.hrv_rmssd_milli) ?? null,
      sleepPerformance: (sleepRecord && sleepRecord.score && sleepRecord.score.sleep_performance_percentage) ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
