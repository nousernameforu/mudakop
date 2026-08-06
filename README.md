Благодраность itdoginfo за оригинальный код [podkop](https://github.com/itdoginfo/podkop)

# mudakop

Маршрутизация трафика для OpenWrt.

# Enhancements
Добавлены: 
* поддержка IPv6 через fakeip и nftables
* sing-box endpoints через режим proxy -> configuration type -> Endpoint Config(можно использовать для WireGuard, AmneziaWG через sing-box-lx)
* парсинг NaiveProxy ссылок для sing-box > 1.13  

# Установка mudakop
```
sh <(wget -O - https://raw.githubusercontent.com/nousernameforu/mudakop/refs/heads/master/install.sh)
```
