# Registry

## Zot

### Authentication
#### Use htpasswd
To simplify we can use simple htpasswd for our stack.
```bash
htpasswd -bBn <username> <password> >> ./docker/zot/htpasswd
```

