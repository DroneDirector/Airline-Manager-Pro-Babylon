package __PACKAGE__;

import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Exit: the game closes completely (its window, its task in the recent apps, and its process) and you are back on the home screen. */
@CapacitorPlugin(name = "AppExit")
public class AppExitPlugin extends Plugin {
    @PluginMethod
    public void exit(PluginCall call) {
        call.resolve();
        getActivity().runOnUiThread(() -> {
            getActivity().finishAndRemoveTask();
            new Handler(Looper.getMainLooper()).postDelayed(() -> { android.os.Process.killProcess(android.os.Process.myPid()); System.exit(0); }, 300);
        });
    }
}
