# foreground monitor 


> [!IMPORTANT]  
> it's generated with ChatGPT, which sucks.  
> Don't bully me for the sh*t code.  

Nothing much for the description, just a toy for fun.

If you want to use it for production(?), edit it for yourself. (but pr is also welcome ;)

## Setup

### Foreground(vite)

```bash
$ yarn i
$ yarn dev
```

### Background(python)

```bash
$ # Make sure that you have `aapt2` on your device.
$ pip install websockets
$ python foreground_ws.py
```

That's all! Visit `localhost:3000`.

## License

MIT license
