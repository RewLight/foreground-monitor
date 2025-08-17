# foreground monitor 


> [!IMPORTANT] 
> THIS IS HTTP VERSION
> 
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
$ # Scripts are under `script/`. Set up venv before interacting with python.🐍
$ cd /script
$ python -m venv env
$ source /env/bin/activate
$ # If you only use `foreground_client.py`, requirements.txt is enough;
$ # but we're here for dev, so we also need Flask.
$ pip install -r dev-requirements.txt
$ # Edit .env for yourself; it's out of the box ready for me.
$ vim .env
$ python devtest_server.py&; python foreground_client.py
```

That's all! Visit `localhost:3000`.

## Build (for production)

Under Investgation.

## License

MIT license
