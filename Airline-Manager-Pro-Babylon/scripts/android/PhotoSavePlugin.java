package __PACKAGE__;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** Photos taken in the game go into the phone's pictures, in Pictures/Airport Dynasty Pro (seen in the gallery). */
@CapacitorPlugin(name = "PhotoSave")
public class PhotoSavePlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String data = call.getString("data"), name = call.getString("name", "photo.png"), mime = call.getString("mime", "image/png");
        if (data == null) { call.reject("No picture"); return; }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            String where;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                v.put(MediaStore.Images.Media.MIME_TYPE, mime);
                v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Airport Dynasty Pro");
                v.put(MediaStore.Images.Media.IS_PENDING, 1);
                ContentResolver r = getContext().getContentResolver();
                Uri u = r.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                if (u == null) { call.reject("The picture couldn't be stored"); return; }
                try (OutputStream o = r.openOutputStream(u)) { o.write(bytes); }
                v.clear(); v.put(MediaStore.Images.Media.IS_PENDING, 0); r.update(u, v, null, null);
                where = "Pictures/Airport Dynasty Pro";
            } else {
                File d = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_PICTURES), "Airport Dynasty Pro");
                d.mkdirs(); File f = new File(d, name);
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(bytes); }
                where = f.getAbsolutePath();
            }
            JSObject ret = new JSObject(); ret.put("where", where); call.resolve(ret);
        } catch (Exception e) {
            call.reject("The picture couldn't be saved: " + e.getMessage());
        }
    }
}
