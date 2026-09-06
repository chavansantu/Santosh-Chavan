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
  Zap,
  ExternalLink,
  Plus,
  Trash2,
  Key,
  Globe,
  Compass
} from 'lucide-react';
import { SystemMetrics, AuthUser, AdminConfig } from '../types';

interface AdminDashboardProps {
  user: AuthUser | null;
  onClose: () => void;
}

type TabType = 'metrics' | 'admins' | 'maps' | 'webhooks' | 'audit';

export function AdminDashboard({ user, onClose }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('metrics');
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multiple Admin Management State
  const [newAdminEmailInput, setNewAdminEmailInput] = useState('');
  const [adminMutating, setAdminMutating] = useState(false);
  const [adminActionStatus, setAdminActionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [simulatedCallerEmail, setSimulatedCallerEmail] = useState(user?.email || 'chavansantu1899@gmail.com');

  // Google Maps Configuration & Tester State
  const [mapsKeyInput, setMapsKeyInput] = useState('');
  const [mapsSaving, setMapsSaving] = useState(false);
  const [mapsStatusNotice, setMapsStatusNotice] = useState<string | null>(null);
  const [testAddressQuery, setTestAddressQuery] = useState('Eiffel Tower, Paris');
  const [testGeocodeResult, setTestGeocodeResult] = useState<any | null>(null);
  const [testGeocodeLoading, setTestGeocodeLoading] = useState(false);

  // Webhook State & SSRF Probes
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookStatusNotice, setWebhookStatusNotice] = useState<string | null>(null);
  const [testMood, setTestMood] = useState('Challenged');
  const [testTheme, setTestTheme] = useState('Resilience Under Pressure');
  const [testSnippet, setTestSnippet] = useState('Key breakthrough in strategic decision-making under high stakes.');
  const [dispatchStatus, setDispatchStatus] = useState<any | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState(false);

  // Fetch admin telemetry & current configurations
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const email = simulatedCallerEmail || user?.email || 'chavansantu1899@gmail.com';
      
      // 1. Fetch Metrics
      const metricsRes = await fetch(`/api/admin/metrics?email=${encodeURIComponent(email)}`, {
        headers: { 'x-admin-email': email },
      });

      if (!metricsRes.ok) {
        const errData = await metricsRes.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${metricsRes.status}: Access Denied (RBAC check failed)`);
      }

      const metricsData: SystemMetrics = await metricsRes.json();
      setMetrics(metricsData);

      // 2. Fetch Config
      const configRes = await fetch(`/api/admin/config?email=${encodeURIComponent(email)}`, {
        headers: { 'x-admin-email': email },
      });

      if (configRes.ok) {
        const configData: AdminConfig = await configRes.json();
        setAdminConfig(configData);
        if (configData.notificationWebhook?.url) {
          setWebhookUrlInput(configData.notificationWebhook.url);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch admin dashboard data:', err);
      setError(err.message || 'Failed to fetch admin telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [simulatedCallerEmail]);

  // Handler: Add new admin email
  const handleAddAdminEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmailInput.trim()) return;

    setAdminMutating(true);
    setAdminActionStatus(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': simulatedCallerEmail,
        },
        body: JSON.stringify({
          action: 'ADD_ADMIN_EMAIL',
          value: newAdminEmailInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add admin email');
      }

      setAdminActionStatus({
        success: true,
        message: `Successfully granted RBAC administrative rights to ${newAdminEmailInput.trim()}`,
      });
      setNewAdminEmailInput('');
      fetchAllData();
    } catch (err: any) {
      setAdminActionStatus({ success: false, message: err.message });
    } finally {
      setAdminMutating(false);
    }
  };

  // Handler: Remove admin email
  const handleRemoveAdminEmail = async (emailToRemove: string) => {
    if (confirm(`Revoke administrative access from ${emailToRemove}?`)) {
      setAdminMutating(true);
      setAdminActionStatus(null);
      try {
        const res = await fetch('/api/admin/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-email': simulatedCallerEmail,
          },
          body: JSON.stringify({
            action: 'REMOVE_ADMIN_EMAIL',
            value: emailToRemove,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to remove admin email');

        setAdminActionStatus({
          success: true,
          message: `Revoked admin privileges from ${emailToRemove}`,
        });
        fetchAllData();
      } catch (err: any) {
        setAdminActionStatus({ success: false, message: err.message });
      } finally {
        setAdminMutating(false);
      }
    }
  };

  // Handler: Save global Google Maps API key
  const handleSaveMapsKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setMapsSaving(true);
    setMapsStatusNotice(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': simulatedCallerEmail,
        },
        body: JSON.stringify({
          action: 'SET_MAPS_KEY',
          value: mapsKeyInput.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update Google Maps API key');
      }

      setMapsStatusNotice('Google Maps Platform key updated successfully. Server proxy active.');
      setMapsKeyInput('');
      fetchAllData();
    } catch (err: any) {
      setMapsStatusNotice(`Error: ${err.message}`);
    } finally {
      setMapsSaving(false);
    }
  };

  // Handler: Test geocoding endpoint
  const handleTestGeocode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testAddressQuery.trim()) return;

    setTestGeocodeLoading(true);
    setTestGeocodeResult(null);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(testAddressQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Geocoding failed');
      setTestGeocodeResult(data);
    } catch (err: any) {
      setTestGeocodeResult({ error: err.message });
    } finally {
      setTestGeocodeLoading(false);
    }
  };

  // Handler: Save Notification Webhook URL
  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setWebhookSaving(true);
    setWebhookStatusNotice(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': simulatedCallerEmail,
        },
        body: JSON.stringify({
          action: 'SET_WEBHOOK_URL',
          value: webhookUrlInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.reason || data.error || 'Failed to save webhook');

      setWebhookStatusNotice('Notification Webhook updated and validated against SSRF blocklist.');
      fetchAllData();
    } catch (err: any) {
      setWebhookStatusNotice(`Error: ${err.message}`);
    } finally {
      setWebhookSaving(false);
    }
  };

  // Handler: Test Dispatch Webhook Notification
  const handleTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchLoading(true);
    setDispatchStatus(null);

    try {
      const res = await fetch('/api/notifications/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookUrlInput.trim() || undefined,
          mood: testMood,
          theme: testTheme,
          summarySnippet: testSnippet,
          locationSummary: 'San Francisco, CA (Admin Console Verification)',
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
        fetchAllData();
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

  const currentAdminList = adminConfig?.adminEmails || metrics?.adminEmails || [
    'chavansantu1899@gmail.com',
    'admin@example.com',
    'security@example.com',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Navigation Header */}
        <div className="px-5 py-3.5 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3 bg-stone-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-100">Admin Security & Telemetry Console</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  RBAC Active
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Active Caller: <span className="font-mono text-amber-300/90">{simulatedCallerEmail}</span> ({currentAdminList.length} Admins Configured)
              </p>
            </div>
          </div>

          {/* Action buttons & close */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAllData}
              disabled={loading}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Refresh Telemetry"
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 border-b border-stone-800 bg-stone-950/30 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-3.5 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'metrics'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>System Telemetry</span>
          </button>

          <button
            onClick={() => setActiveTab('admins')}
            className={`px-3.5 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'admins'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Admin Emails ({currentAdminList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('maps')}
            className={`px-3.5 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'maps'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Google Maps API Key</span>
          </button>

          <button
            onClick={() => setActiveTab('webhooks')}
            className={`px-3.5 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'webhooks'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Notification Webhook</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: System Telemetry */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              {/* Tenant Privacy Guarantee */}
              <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 text-xs flex items-start gap-3 text-stone-300">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-stone-100">Zero Cross-Tenant Leaks Guarantee: </span>
                  Administrators receive aggregated counts and system telemetry only. Under no circumstances can raw journal reflections or private thoughts of other users be accessed or retrieved.
                </div>
              </div>

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
                        <span className="text-xs">Configured Admins</span>
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                      </div>
                      <p className="text-2xl font-bold text-stone-100">{currentAdminList.length}</p>
                      <p className="text-[10px] text-stone-400 mt-1">Elevated RBAC roles</p>
                    </div>
                  </div>

                  {/* Mood Distribution & Gemini Fallback Ladder */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-stone-950/50 border border-stone-800">
                      <h3 className="text-xs font-semibold text-stone-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-400" />
                        Aggregated Mood Distribution
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
                </>
              ) : null}
            </div>
          )}

          {/* TAB 2: Multiple Admin Emails (RBAC Management) */}
          {activeTab === 'admins' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-200">
                    Multiple Administrator Accounts (RBAC)
                  </h3>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed mb-4">
                  Manage all organizational email addresses authorized with administrative RBAC permissions. 
                  Administrators can inspect telemetry, manage API credentials, and review security audit trails.
                </p>

                {/* List of currently configured admins */}
                <div className="space-y-2 mb-4">
                  <span className="text-xs font-medium text-stone-300">Active Authorized Administrators:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentAdminList.map((admEmail) => (
                      <div
                        key={admEmail}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-stone-900 border border-stone-800 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span className="font-mono text-stone-200 truncate">{admEmail}</span>
                          {admEmail === simulatedCallerEmail && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Current
                            </span>
                          )}
                        </div>

                        {currentAdminList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAdminEmail(admEmail)}
                            disabled={adminMutating}
                            className="text-stone-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                            title="Revoke Admin Permissions"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form to Add New Admin */}
                <form onSubmit={handleAddAdminEmail} className="pt-3 border-t border-stone-800/80">
                  <label className="block text-xs font-medium text-stone-300 mb-1.5">
                    Authorize Additional Admin Email:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newAdminEmailInput}
                      onChange={(e) => setNewAdminEmailInput(e.target.value)}
                      placeholder="colleague@example.com"
                      required
                      className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder-stone-400 font-mono focus:outline-none focus:border-amber-500/40"
                    />
                    <button
                      type="submit"
                      disabled={adminMutating || !newAdminEmailInput.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {adminMutating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Add Admin</span>
                    </button>
                  </div>
                </form>

                {adminActionStatus && (
                  <div className={`mt-3 p-3 rounded-xl text-xs border ${
                    adminActionStatus.success
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-800 text-rose-300'
                  }`}>
                    {adminActionStatus.message}
                  </div>
                )}
              </div>

              {/* RBAC Identity Simulator / Verification Tester */}
              <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 text-xs">
                <h4 className="font-semibold text-stone-200 mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  RBAC Identity Verification Simulator
                </h4>
                <p className="text-stone-400 mb-3">
                  Simulate access as another configured administrator or a non-admin to verify RBAC access boundary enforcement:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {currentAdminList.slice(0, 4).map((adm) => (
                    <button
                      key={adm}
                      type="button"
                      onClick={() => setSimulatedCallerEmail(adm)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-colors cursor-pointer ${
                        simulatedCallerEmail === adm
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                      }`}
                    >
                      Simulate {adm.split('@')[0]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSimulatedCallerEmail('unauthorized_user@sample.com')}
                    className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-colors cursor-pointer ${
                      simulatedCallerEmail === 'unauthorized_user@sample.com'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-stone-900 text-rose-400 hover:bg-rose-950/30 border border-stone-800'
                    }`}
                  >
                    Simulate Unauthorized User
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Global Google Maps API Key */}
          {activeTab === 'maps' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-200">
                      Global Google Maps Platform Configuration
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    adminConfig?.googleMaps.configured
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}>
                    {adminConfig?.googleMaps.configured ? 'Google Maps Key Active' : 'Fallback Geocoder Active'}
                  </span>
                </div>

                <p className="text-xs text-stone-400 leading-relaxed mb-4">
                  In accordance with the Google Maps Directive, the <code className="text-amber-300/90 font-mono">GOOGLE_MAPS_API_KEY</code> is maintained exclusively on the server side. Zero client-side keys are bundled in the browser. Forward geocoding and reverse geocoding route through <code className="text-amber-300/90 font-mono">/api/geocode</code>.
                </p>

                {/* Configuration Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs">
                  <div className="p-3 rounded-xl bg-stone-900 border border-stone-800">
                    <span className="text-stone-400 block mb-1">Active Geocoding Provider:</span>
                    <span className="font-semibold text-stone-200">
                      {adminConfig?.googleMaps.provider || 'Google Maps Platform (Server Proxy)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-900 border border-stone-800">
                    <span className="text-stone-400 block mb-1">Masked Server-Side Key:</span>
                    <span className="font-mono text-amber-300">
                      {adminConfig?.googleMaps.maskedKey || 'Not Configured (Using Nominatim Fallback)'}
                    </span>
                  </div>
                </div>

                {/* Security Capabilities Checklist */}
                <div className="p-3 rounded-xl bg-stone-900/70 border border-stone-800 text-xs mb-4">
                  <span className="font-semibold text-stone-300 block mb-2">Maps Security & Platform Capabilities:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-400">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Forward Geocoding (Address to Lat/Lng)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Reverse Geocoding (GPS to Place Name)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Strict Coordinate Bound Validation ([-90,90], [-180,180])</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Zero Client-Side Token Extraction Risk</span>
                    </div>
                  </div>
                </div>

                {/* Update Key Input */}
                <form onSubmit={handleSaveMapsKey} className="pt-3 border-t border-stone-800">
                  <label className="block text-xs font-medium text-stone-300 mb-1.5">
                    Set / Update Global Google Maps API Key:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={mapsKeyInput}
                      onChange={(e) => setMapsKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder-stone-400 font-mono focus:outline-none focus:border-amber-500/40"
                    />
                    <button
                      type="submit"
                      disabled={mapsSaving || !mapsKeyInput.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {mapsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                      <span>Save Maps Key</span>
                    </button>
                  </div>
                </form>

                {mapsStatusNotice && (
                  <div className="mt-3 p-3 rounded-xl text-xs bg-amber-950/40 border border-amber-800 text-amber-300">
                    {mapsStatusNotice}
                  </div>
                )}
              </div>

              {/* Live Geocoding Interactive Tester */}
              <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 text-xs">
                <h4 className="font-semibold text-stone-200 mb-2 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-amber-400" />
                  Live Geocoding Proxy Tester
                </h4>
                <p className="text-stone-400 mb-3">
                  Test address query resolution through the server-side geocoding endpoint:
                </p>
                <form onSubmit={handleTestGeocode} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={testAddressQuery}
                    onChange={(e) => setTestAddressQuery(e.target.value)}
                    placeholder="Enter city, landmark, or address..."
                    className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder-stone-400 font-mono focus:outline-none focus:border-amber-500/40"
                  />
                  <button
                    type="submit"
                    disabled={testGeocodeLoading}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors cursor-pointer"
                  >
                    {testGeocodeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> : 'Test Geocode'}
                  </button>
                </form>

                {testGeocodeResult && (
                  <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 font-mono text-[11px] text-stone-300">
                    {testGeocodeResult.error ? (
                      <span className="text-rose-400">Error: {testGeocodeResult.error}</span>
                    ) : (
                      <div className="space-y-1">
                        <p><span className="text-stone-400">Place:</span> {testGeocodeResult.placeName}</p>
                        <p><span className="text-stone-400">Coordinates:</span> {testGeocodeResult.latitude}°, {testGeocodeResult.longitude}°</p>
                        <p><span className="text-stone-400">Formatted:</span> {testGeocodeResult.formattedAddress}</p>
                        <p><span className="text-stone-400">Provider:</span> {testGeocodeResult.provider}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Notification Webhook */}
          {activeTab === 'webhooks' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-200">
                      External Notification Webhook & SSRF Defense
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    adminConfig?.notificationWebhook.configured
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-stone-800 text-stone-400 border-stone-700'
                  }`}>
                    {adminConfig?.notificationWebhook.configured ? 'Global Webhook Set' : 'Custom Dispatch Ready'}
                  </span>
                </div>

                <p className="text-xs text-stone-400 leading-relaxed mb-4">
                  Automatically delivers privacy-preserving milestone alerts (e.g. Challenged reflections or significant growth insights) to Slack, Discord, or HTTPS endpoints. 
                  Internal IPs, link-local addresses, and cloud metadata (<code className="text-amber-300/90 font-mono">169.254.169.254</code>) are blocked server-side.
                </p>

                {/* Webhook URL configuration */}
                <form onSubmit={handleSaveWebhook} className="space-y-3 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Global Notification Webhook URL:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={webhookUrlInput}
                        onChange={(e) => setWebhookUrlInput(e.target.value)}
                        placeholder="https://hooks.slack.com/services/... or https://discord.com/api/webhooks/..."
                        className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder-stone-400 font-mono focus:outline-none focus:border-amber-500/40"
                      />
                      <button
                        type="submit"
                        disabled={webhookSaving || !webhookUrlInput.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        {webhookSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Webhook'}
                      </button>
                    </div>
                  </div>
                </form>

                {webhookStatusNotice && (
                  <div className="mb-4 p-3 rounded-xl text-xs bg-amber-950/40 border border-amber-800 text-amber-300">
                    {webhookStatusNotice}
                  </div>
                )}

                {/* SSRF Demonstration Quick Probes */}
                <div className="pt-3 border-t border-stone-800 mb-5">
                  <span className="block text-xs font-medium text-stone-300 mb-2">
                    SSRF Defense Quick Probes:
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setWebhookUrlInput('http://169.254.169.254/computeMetadata/v1/')}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-900/60 hover:bg-rose-900/50 cursor-pointer"
                    >
                      Cloud Metadata Probe (Will Block)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWebhookUrlInput('http://localhost:3000/api/health')}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-900/60 hover:bg-rose-900/50 cursor-pointer"
                    >
                      Localhost Probe (Will Block)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWebhookUrlInput('http://192.168.1.1/admin')}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-900/60 hover:bg-rose-900/50 cursor-pointer"
                    >
                      Private Subnet 192.168.x (Will Block)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWebhookUrlInput('https://httpbin.org/post')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-900/60 hover:bg-emerald-900/50 cursor-pointer"
                    >
                      Safe Public HTTPS (Will Pass)
                    </button>
                  </div>
                </div>

                {/* Interactive Test Dispatch */}
                <form onSubmit={handleTestNotification} className="space-y-3 pt-3 border-t border-stone-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-stone-400 mb-1">Test Mood</label>
                      <input
                        type="text"
                        value={testMood}
                        onChange={(e) => setTestMood(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-400 mb-1">Test Theme</label>
                      <input
                        type="text"
                        value={testTheme}
                        onChange={(e) => setTestTheme(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-stone-400 mb-1">Summary Snippet</label>
                    <input
                      type="text"
                      value={testSnippet}
                      onChange={(e) => setTestSnippet(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-200"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={dispatchLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {dispatchLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispatching Webhook...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Dispatch Test Alert</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

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
                          <span>Notification Delivered Successfully (HTTP {dispatchStatus.httpStatus})</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span>Security Violation / Dispatch Error: {dispatchStatus.error}</span>
                        </>
                      )}
                    </div>
                    {dispatchStatus.reason && <p className="text-[11px] opacity-90">{dispatchStatus.reason}</p>}
                    {dispatchStatus.target && <p className="text-[10px] font-mono mt-1 opacity-75">Target: {dispatchStatus.target}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Security Audit Trail */}
          {activeTab === 'audit' && (
            <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
              <h3 className="text-xs font-semibold text-stone-200 uppercase tracking-wider mb-3">
                Administrative & SSRF Security Audit Trail
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
                    {(metrics?.recentAuditLogs || []).map((log) => (
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
          )}
        </div>
      </div>
    </div>
  );
}
