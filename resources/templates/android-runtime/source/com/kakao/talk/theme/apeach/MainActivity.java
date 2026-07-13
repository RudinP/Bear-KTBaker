package com.kakao.talk.theme.apeach;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;

/**
 * Resource-independent launcher bundled with KakaoTalk Theme Studio.
 *
 * The class deliberately has no generated R references. A single precompiled
 * classes.dex can therefore be reused while AAPT2 assigns resource IDs for
 * each exported theme and package name.
 */
public final class MainActivity extends Activity {
    private static final String KAKAOTALK_PACKAGE_NAME = "com.kakao.talk";
    private static final String KAKAOTALK_THEME_URI = "kakaotalk://settings/theme/";
    private static final String MARKET_URI = "market://details?id=";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String target = isKakaoTalkInstalled()
                ? KAKAOTALK_THEME_URI + getPackageName()
                : MARKET_URI + KAKAOTALK_PACKAGE_NAME;
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(target)));
        finish();
    }

    private boolean isKakaoTalkInstalled() {
        try {
            getPackageManager().getPackageInfo(KAKAOTALK_PACKAGE_NAME, 0);
            return true;
        } catch (PackageManager.NameNotFoundException ignored) {
            return false;
        }
    }
}
