server-v-1.5.js		- версия сервера с кешированием

config-passport.js	- настройка конфигурации passport.js
db-config.js        - настройка конфигурации базы данных

package.json		- файл зависимостей для сервера


docker build -t my-docker-web-app . - сборка Docker-образа 
                                    - -t my-docker-web-app - имя образа
                                    . — путь к Dockerfile (текущая папка).
