# foreground monitor 

> [!CAUTION]
> <h1>Please stay tuned for Autox.js version.</h1>
> so here's the deprecated version. :(

> [!TIP] 
> THIS IS HTTP VERSION
> it's also generated with ChatGPT, which sucks.  
> Don't bully me for the sh*t code.

Nothing much for the description, just a toy for fun.

~~If you want to use it for production(?), edit it for yourself. (but pr is also welcome ;)~~

I haven't finish server-side code yet.

## Setup (for dev)

### Foreground(vite)

```bash
$ yarn i
$ yarn dev
```

### Background(python)

```bash
$ # Make sure that you have `aapt2` on your device.
$ # Also, do not forget to connect your device via adb. (make sure they're prepared!)
$ # Scripts are under `script/`.
$ cd /script
$ python -m venv env
$ source /env/bin/activate
$ python devtest_server.py&; python foreground_client.py
```

That's all! Visit `localhost:3000`.

## Setup for end user

> [!TIP]
> Auto configure script will be ready s∞n.

1. Install `termux` app ([Here's the F-Droid link](https://f-droid.org/repo/com.termux_1022.apk))
2. Install `aapt2` and `android-tools`.
   ```bash
   $ pkg update
   $ pkg install aapt2 android-tools
   ```
3. Connect your device
   - via Wireless ADB (Android 11 or above, **NOT Recommended**)
     1. Open Termux as a floating window
     2. Turn on Developer Options for your device model (if you don't know how to, then Google/Bing it.)
     3. Turn on USB Debugging and Wireless Debugging
     4. Tap "Pair device with pairing code" in "Wireless debugging"
     5. Back to Termux, enter `adb pair {ip_address}:{port}`, and then enter pairing code.
        > 
        > **The `ip_address` and `port` here are displayed in the pop-up window.**
        > 
     7. Enter `adb connect {ip_address}:{port}`, and accept to debug.
        > 
        > **The `ip_address` and `port` here are displayed in the Wireless Debugging page.**
        >
     8. Enter `wget https://github.com/RewLight/foreground-monitor/releases/download/pre/foreground_client; chmod +x foreground_client`;
     9. Edit `.env.local` (create it if doesn't exist), here's the template [.env.example](https://github.com/RewLight/foreground-monitor/blob/lyxmb-api/script/.env.example)
     10. `./foreground_client` to run.

# License
MIT License.
