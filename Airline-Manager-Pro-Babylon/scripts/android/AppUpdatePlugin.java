package __PACKAGE__;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Updates from inside the game: downloads the new APK and hands it to Android's package installer, which installs it
 * over this version (same key, so everything is kept). Progress goes out as "updateProgress" {pct}, the outcome as
 * "updateResult" {ok, status, code, message} with Android's own reason when it refuses.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private static final String ACTION_STATUS = ".UPDATE_STATUS";
    private boolean busy = false;
    private BroadcastReceiver statusReceiver;

    private boolean canInstallNow() { return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls(); }

    @PluginMethod
    public void canInstall(PluginCall call) { JSObject r = new JSObject(); r.put("canInstall", canInstallNow()); call.resolve(r); }

    @PluginMethod
    public void openInstallPermission(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) { call.reject(describe(e)); }
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("No download address"); return; }
        if (!canInstallNow()) { JSObject r = new JSObject(); r.put("started", false); r.put("needsPermission", true); call.resolve(r); return; }
        if (busy) { call.reject("An update is already being installed"); return; }
        busy = true;
        JSObject r = new JSObject(); r.put("started", true); call.resolve(r);
        new Thread(() -> {
            String step = "download";
            try { File apk = download(url); step = "install"; install(apk); }
            catch (Exception e) { busy = false; result(false, -1, step.equals("download") ? "DOWNLOAD_FAILED" : "INSTALL_SESSION_FAILED", describe(e)); }
        }).start();
    }

    private File download(String url) throws Exception {
        File out = new File(getContext().getCacheDir(), "update.apk");
        HttpURLConnection c = null; String u = url;
        for (int hop = 0; hop < 6; hop++) {
            c = (HttpURLConnection) new URL(u).openConnection();
            c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(30000);
            c.setRequestProperty("Accept", "application/octet-stream");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) { u = new URL(new URL(u), c.getHeaderField("Location")).toString(); c.disconnect(); continue; }
            if (code != 200) throw new Exception("Download failed: HTTP " + code + " from " + new URL(u).getHost());
            break;
        }
        long total = c.getContentLengthLong();
        try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(out)) {
            byte[] buf = new byte[64 * 1024]; long got = 0; int n, lastPct = -1;
            while ((n = in.read(buf)) > 0) {
                os.write(buf, 0, n); got += n;
                int pct = total > 0 ? (int) (got * 100 / total) : -1;
                if (pct != lastPct) { lastPct = pct; JSObject p = new JSObject(); p.put("pct", pct); p.put("bytes", got); notifyListeners("updateProgress", p); }
            }
            if (total > 0 && got != total) throw new Exception("Download incomplete: " + got + " of " + total + " bytes");
        } finally { c.disconnect(); }
        return out;
    }

    private void install(File apk) throws Exception {
        Context ctx = getContext().getApplicationContext();
        PackageInstaller pi = ctx.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(ctx.getPackageName());
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int id = pi.createSession(params);
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (InputStream in = new FileInputStream(apk); OutputStream os = s.openWrite("app.apk", 0, apk.length())) {
                byte[] buf = new byte[64 * 1024]; int n; while ((n = in.read(buf)) > 0) os.write(buf, 0, n); s.fsync(os);
            }
            String action = ctx.getPackageName() + ACTION_STATUS;
            registerStatusReceiver(action);
            Intent i = new Intent(action).setPackage(ctx.getPackageName());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            s.commit(PendingIntent.getBroadcast(ctx, id, i, flags).getIntentSender());
        }
    }

    private void registerStatusReceiver(String action) {
        if (statusReceiver != null) return;
        statusReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent intent) {
                int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
                if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                    Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
                    if (confirm != null) { confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); try { getActivity().startActivity(confirm); } catch (Exception e) { busy = false; result(false, status, "CONFIRM_FAILED", describe(e)); } }
                    return;
                }
                busy = false;
                String msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE), other = intent.getStringExtra(PackageInstaller.EXTRA_OTHER_PACKAGE_NAME);
                if (other != null) msg = (msg == null ? "" : msg + " ") + "(conflicts with " + other + ")";
                result(status == PackageInstaller.STATUS_SUCCESS, status, statusName(status), msg == null ? "" : msg);
            }
        };
        ContextCompat.registerReceiver(getContext().getApplicationContext(), statusReceiver, new IntentFilter(action), ContextCompat.RECEIVER_EXPORTED);
    }

    private void result(boolean ok, int status, String code, String message) {
        JSObject r = new JSObject(); r.put("ok", ok); r.put("status", status); r.put("code", code); r.put("message", message);
        notifyListeners("updateResult", r, true);
    }

    static String statusName(int s) {
        switch (s) {
            case PackageInstaller.STATUS_SUCCESS: return "SUCCESS";
            case PackageInstaller.STATUS_FAILURE_ABORTED: return "FAILURE_ABORTED";
            case PackageInstaller.STATUS_FAILURE_BLOCKED: return "FAILURE_BLOCKED";
            case PackageInstaller.STATUS_FAILURE_CONFLICT: return "FAILURE_CONFLICT";
            case PackageInstaller.STATUS_FAILURE_INCOMPATIBLE: return "FAILURE_INCOMPATIBLE";
            case PackageInstaller.STATUS_FAILURE_INVALID: return "FAILURE_INVALID";
            case PackageInstaller.STATUS_FAILURE_STORAGE: return "FAILURE_STORAGE";
            case 8: return "FAILURE_TIMEOUT";
            default: return "FAILURE";
        }
    }

    static String describe(Throwable e) { String m = e.getMessage(); return e.getClass().getSimpleName() + (m == null ? "" : ": " + m); }

    @Override
    protected void handleOnDestroy() {
        if (statusReceiver != null) { try { getContext().getApplicationContext().unregisterReceiver(statusReceiver); } catch (Exception ignored) { } statusReceiver = null; }
    }
}
