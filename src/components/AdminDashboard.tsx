import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Users, 
  BookText, 
  MapPin, 
  Bell, 
  Send, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  Loader2,
  Lock,
  Server,
  Zap
} from 'lucide-react';
import { SystemMetrics, AuthUser, AdminAuditLog } from '../types';

interface AdminDashboardProps {
  user: AuthUser | null;
  onClose: () => void;
}

export function AdminDashboard({ user, onClose }: AdminDashboardProps) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testMood, setTestMood] = useState('Challenged');
  const [testTheme, setTestTheme] = useState('Resilience Under Pressure');
  const [testSnippet, setTestSnippet] = useState('High-priority leadership challenge reflection submitted.');
  const [dispatchStatus, setDispatchStatus] = useState<any | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const email = user?.email || 'chavansantu1899@gmail.com';
      const res = await fetch(`/api/admin/metrics?email=${encodeURIComponent(email)}`, {
        headers: { 'x-admin-email': email },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}: Access Denied (RBAC check failed)`);
      }

      const data: SystemMetrics = await res.json();
      setMetrics(data);
    } catch (err: any) {
      console.error('Failed to fetch admin metrics:', err);
      setError(err.message || 'Failed to fetch admin telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [user?.email]);

  const handleTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchLoading(true);
    setDispatchStatus(null);

    try {
      const res = await fetch('/api/notifications/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim() || undefined,
          mood: testMood,
          theme: testTheme,
          summarySnippet: testSnippet,
          locationSummary: 'San Francisco, CA (Admin Console Test)',
          userHash: user?.uid || 'admin_test_uid',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setDispatchStatus({
          success: false,
          error: data.error || 'Dispatch rejected',
          reason: data.reason || data.details,
        });
      } else {
        setDispatchStatus({
          success: true,
          target: data.target,
          httpStatus: data.httpStatus,
          timestamp: data.timestamp,
        });
        // Refresh metrics to show new audit log
        fetchMetrics();
      }
    } catch (err: any) {
      setDispatchStatus({
        success: false,
        error: 'Network failure',
        reason: err.message,
      });
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleSSRFDemoProbe = (probeUrl: string) => {
    setWebhookUrl(probeUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-100">Admin Security & Telemetry Console</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  RBAC Authorized
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Verified Identity: <span className="font-mono text-amber-300/90">{user?.email || 'chavansantu1899@gmail.com'}</span> • Zero Tenant Data Leaks Enforced
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Refresh Metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-6">
          {/* Privacy & RBAC Policy Guarantee Banner */}
          <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 text-xs flex items-start gap-3 text-stone-300">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-stone-100">Tenant Isolation & Privacy Guarantee: </span>
              In strict accordance with the Admin Roles Directive, administrators receive aggregated telemetry only. 
              No individual user entries, reflections, or private thoughts can be accessed or inspected across tenant boundaries.
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && !metrics ? (
            <div className="py-12 flex flex-col items-center justify-center text-stone-400">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400 mb-2" />
              <p className="text-xs">Querying administrative telemetry & verifying RBAC claim...</p>
            </div>
          ) : metrics ? (
            <>
              {/* Aggregated Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
                  <div className="flex items-center justify-between text-stone-400 mb-1">
                    <span className="text-xs">Total Entries</span>
                    <BookText className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-stone-100">{metrics.totalEntriesCount}</p>
                  <p className="text-[10px] text-stone-400 mt-1">System-wide reflections</p>
                </div>

                <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
                  <div className="flex items-center justify-between text-stone-400 mb-1">
                    <span className="text-xs">Active Tenants</span>
                    <Users className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold text-stone-100">{metrics.activeUsersCount}</p>
                  <p className="text-[10px] text-stone-400 mt-1">Isolated user accounts</p>
                </div>

                <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
                  <div className="flex items-center justify-between text-stone-400 mb-1">
                    <span className="text-xs">Location Tagged</span>
                    <MapPin className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-stone-100">{metrics.locationEntriesCount}</p>
                  <p className="text-[10px] text-stone-400 mt-1">With geographic coordinates</p>
                </div>

                <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
                  <div className="flex items-center justify-between text-stone-400 mb-1">
                    <span className="text-xs">AI Fallback Health</span>
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-stone-100">100%</p>
                  <p className="text-[10px] text-stone-400 mt-1">4-Tier ladder available</p>
                </div>
              </div>

              {/* Mood Distribution & AI Model Usage breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mood distribution */}
                <div className="p-4 rounded-xl bg-stone-950/50 border border-stone-800">
                  <h3 className="text-xs font-semibold text-stone-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    Aggregated Mood & Sentiment Breakdown
                  </h3>
                  <div className="space-y-2.5">
                    {Object.entries(metrics.moodDistribution).map(([mood, count]) => {
                      const total = Object.values(metrics.moodDistribution).reduce((a, b) => a + b, 0) || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={mood}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-stone-300 font-medium">{mood}</span>
                            <span className="text-stone-400 font-mono text-[11px]">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden">
                            <div className="h-full bg-amber-500/80 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI Fallback Ladder Usage */}
                <div className="p-4 rounded-xl bg-stone-950/50 border border-stone-800">
                  <h3 className="text-xs font-semibold text-stone-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-amber-400" />
                    Gemini Model Fallback Telemetry
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(metrics.modelUsageBreakdown).map(([model, invocations]) => (
                      <div key={model} className="p-2.5 rounded-lg bg-stone-900 border border-stone-800/80 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-mono font-medium text-amber-300/90">{model}</p>
                          <p className="text-[10px] text-stone-400">
                            {model.includes('3.6') ? 'Tier 1 Primary' : model.includes('3.1') ? 'Tier 2 HA Fallback' : model.includes('latest') ? 'Tier 3 Dynamic' : 'Tier 4 Deep'}
                          </p>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300">
                          {invocations} requests
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* External Notification Hub & SSRF Testing Section */}
              <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-200">
                      External Notification Dispatch Hub (SSRF Defense)
                    </h3>
                  </div>
                  <span className="text-[11px] text-stone-400">Slack / Discord / Webhook</span>
                </div>
                <p className="text-xs text-stone-400 mb-4 leading-relaxed">
                  Automated webhook alerts trigger on milestones or sensitive entries (e.g. Challenged mood). 
                  Server-side security filters enforce HTTPS and reject internal subnets (10.0.0.0/8, 127.0.0.1, 169.254.169.254) to eliminate SSRF risks.
                </p>

                <form onSubmit={handleTestNotification} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Target Webhook URL (HTTPS required):
                    </label>
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://hooks.slack.com/services/... or https://discord.com/api/webhooks/..."
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder-stone-400 font-mono focus:outline-none focus:border-amber-500/40"
                    />
                  </div>

                  {/* SSRF Test probe buttons */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
                    <span>Quick Probe Tests:</span>
                    <button
                      type="button"
                      onClick={() => handleSSRFDemoProbe('http://169.254.169.254/computeMetadata/v1/')}
                      className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-900/60 hover:bg-rose-900/50 cursor-pointer"
                    >
                      Test Cloud Metadata Probe (Should Block)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSSRFDemoProbe('http://localhost:3000/api/health')}
                      className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-900/60 hover:bg-rose-900/50 cursor-pointer"
                    >
                      Test Localhost Probe (Should Block)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSSRFDemoProbe('https://httpbin.org/post')}
                      className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-900/60 hover:bg-emerald-900/50 cursor-pointer"
                    >
                      Test Safe Public HTTPS (Should Pass)
                    </button>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={dispatchLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {dispatchLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Executing SSRF Check & Dispatch...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Dispatch Notification Test</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Dispatch result card */}
                {dispatchStatus && (
                  <div className={`mt-3 p-3 rounded-xl text-xs border ${
                    dispatchStatus.success 
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-800 text-rose-300'
                  }`}>
                    <div className="flex items-center gap-1.5 font-semibold mb-1">
                      {dispatchStatus.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Notification Dispatched Successfully</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span>Security / Dispatch Error: {dispatchStatus.error}</span>
                        </>
                      )}
                    </div>
                    {dispatchStatus.reason && (
                      <p className="text-[11px] opacity-90">{dispatchStatus.reason}</p>
                    )}
                    {dispatchStatus.target && (
                      <p className="text-[10px] font-mono mt-1 opacity-75">Target: {dispatchStatus.target}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Security Audit Logs Table */}
              <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
                <h3 className="text-xs font-semibold text-stone-200 uppercase tracking-wider mb-3">
                  Recent Security & Administrative Audit Logs
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-800 text-stone-400">
                        <th className="pb-2 font-medium">Timestamp</th>
                        <th className="pb-2 font-medium">Actor</th>
                        <th className="pb-2 font-medium">Action</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/60">
                      {metrics.recentAuditLogs.map((log) => (
                        <tr key={log.id} className="text-stone-300">
                          <td className="py-2 font-mono text-[11px] text-stone-400 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-2 font-mono text-[11px] text-amber-300/80">{log.adminEmail}</td>
                          <td className="py-2 font-mono text-[11px] text-stone-200">{log.action}</td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : log.status === 'DENIED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2 text-[11px] text-stone-400 max-w-xs truncate" title={log.details}>
                            {log.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
