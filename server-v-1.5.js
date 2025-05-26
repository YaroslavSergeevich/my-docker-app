import express from 'express';                          // благодать небесная 
import fsp from 'fs/promises';                          // Для асинхронной работы с файлами
import { createWriteStream } from 'fs';                 // Для синхронной работы с файлами, необходимой для моргана
import path from 'path';                                // Для работы с путями
import morgan from 'morgan';                            // для логгирования         
import passport from 'passport';                        // подключение модуля passport - аутентификация
import session from 'express-session';                  // Добавляем модуль для сессий
import { createRequire } from 'module';                 // Импортируем createRequire
const require = createRequire(import.meta.url);         // Создаем аналог require для ES-модулей
const FileStore = require('session-file-store')(session);// Подключаем session-file-store как в CommonJS
import './config-passport.js';                          // импорт настроек паспорта
import { User } from './config-passport.js';
import methodOverride from 'method-override';           // костыль для put / delete запросов
import NodeCache from 'node-cache';                     // Подключаем node-cache

const app = express();
const port = 8080;

const cache = new NodeCache({                           // Инициализация кеша
  stdTTL: 60 * 10,                                           // Время жизни записей по умолчанию (10 минут)
  checkperiod: 120                                      // Интервал проверки просроченных записей (120 сек)
});

const PATHS = {                                         // Константы с путями к файлам
  LOGS: {
    SERVER: path.join(process.cwd(), 'logs', 'server.log')
  },
  JSON: {
    USER_INPUT: path.join(process.cwd(), 'json', 'users-input-data.json'),
    USER_DB: path.join(process.cwd(), 'data', 'user-DB.json')
  },
  SESSIONS: path.join(process.cwd(), 'sessions'),
  STATIC: {
    PICTURES: 'picture',
    STYLES: 'style'
  }
};

const log_stream = createWriteStream(                   // настройка потоков для записи логов в файл
  PATHS.LOGS.SERVER,                                    // расположение файла логов
  { flags: 'a' });                                      // 'a' - append (добавлять новые записи)
  
  
const logger = morgan('common', {                       // Инициализация логгеров
  stream: log_stream                                    // Все логи идут в один файл 
});
  
const saveDataToFile = async (data, file) => {          // функция сохранения полученных данных из поля в файл
  let existingData = [];                                // Читаем существующие данные
  try {
    const fileContent = await fsp.readFile(file, 'utf-8');
    if (fileContent.trim() !== '') {                    // Проверяем, не пустой ли файл
      existingData = JSON.parse(fileContent);
    }
  } catch (readErr) {
    if (readErr.code !== 'ENOENT') {                    // Игнорируем только ошибку "файл не существует"
      throw readErr;                                    // Пробрасываем все другие ошибки
    }
  }
  
  const dataWithTimestamp = {                           // Добавляем временную метку к данным
    ...data,
    time_to_get: new Date().toISOString()               // Добавляем время в ISO-формате
  };

  // Добавляем новые данные и сохраняем
  existingData.push(dataWithTimestamp);
  await fsp.writeFile(file, JSON.stringify(existingData, null, 2));
};

const saveUserToFile = async (data) => {                // функция сохранения полученных данных из поля в файл
  const newUser  = await User.create(data);           // Добавляем временную метку к данным

  cache.del('users');                                   // Инвалидация кеша пользователей
  cache.set(`user:${newUser.id}`, newUser);

  return newUser;
};

const getUserById = async (id) => {                     // Функция для получения пользователя с кешированием
  const cachedUser = cache.get(`user:${id}`);
  if (cachedUser) return cachedUser;

  const user = await User.findByPk(id);
  if (user) cache.set(`user:${id}`, user);
  return user;
};

const auth = (req, res, next) => {                      // функция проверки аутентификации
  if (req.isAuthenticated()){
    next()
  } else {
    return res.redirect('/login')
  }

}

app.set('trust proxy', 1);

app.use(express.static(PATHS.STATIC.PICTURES));                     // папка для статичный файлов - картинки

app.use(express.static(PATHS.STATIC.STYLES));                       // папка для статичных файлов - стиль

app.set('view engine', 'ejs');                          // подключаем ejs как движок для рендера файлов

app.use(logger)                                         // подключаем логгер morgan

app.use(express.json());
app.use(express.urlencoded({extended: false}));         // парсер получаемых данных)

app.use(                                                // подключаем сессии
  session({                                             // описание сессии
    secret: process.env.SESSION_SECRET || 'bombardiro_crocodilo',                     // ключ, знает только сервер
    store: new FileStore({                                      // хранилище сессий
      path: PATHS.SESSIONS}),                                                
    cookie: {
        path: '/',                                      // на какие пути распространяются куки
        httpOnly: true,                                 // куки видит только браузер 
        maxAge: 24* 60 * 60 * 1000,                     // время жизни куки - сутки
        secure: false, 
        sameSite: 'lax'
    },
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/styles', express.static(PATHS.STATIC.STYLES, {// кеширование файла стилей (хранится в брузере)
  maxAge: '7d',                                         // Кэш на 7 дней
  lastModified: true,                                   // Браузер проверит изменения (проверяет через ETag)
  etag: true                                            // Браузер будет проверять хеш содержимого
}));

app.use('/pictures', express.static(PATHS.STATIC.PICTURES, {// кеширование файла стилей (хранится в брузере)
  maxAge: '30d',                                        // Кэш на 7 дней
  etag: true                                            // Браузер будет проверять хеш содержимого
}));

app.use(methodOverride('_method'));                     // для обработок put/delete запросов 

app.get('/', (req, res) => {                            // обработка начальной страницы
  const cachedHtml = cache.get('homePage');             // проверка на наличие кэша
  if (cachedHtml) return res.send(cachedHtml);          // если он есть, то обращаемся к нему

  const html = res.render('index');
  cache.set('homePage', html, 60);                      // создаём кеш страницы на 60 секунд, если раньше его не было
});

app.get('/text', (req, res) => {                        // обработка страницы с текстом
  const cachedHtml = cache.get('textPage');             // проверка на наличие кэша
  if (cachedHtml) return res.send(cachedHtml);          // если он есть, то обращаемся к нему

  const html = res.render('text');
  cache.set('textPage', html, 60);                      // создаём кеш страницы на 60 секунд, если раньше его не было
});

app.get('/input', (req, res) => {                       // обработка get страницы с вводом (не кешируем, т.к. не статична)
  res.render('input', {
    success: req.query.success
  })
});

app.get('/table', (req, res) => {                       // обработка страницы с таблицей
  const cachedHtml = cache.get('tablePage');            // проверка на наличие кэша
  if (cachedHtml) return res.send(cachedHtml);          // если он есть, то обращаемся к нему


  const html = res.render('table');
  cache.set('tablePage', html, 60);                     // создаём кеш страницы на 60 секунд, если раньше его не было
});

app.get('/login', (req, res) => {                       // обработка страницы с входом (не кешируем, т.к. не статична)
  res.render('login', {error: req.query.error});
});

app.get('/registr', (req, res) => {                     // обработка страницы с регистрацией 
  res.render('registr')                                 // (не кешируем, т.к. редко используется)
});

app.get('/profile', auth, async(req, res) => {          // обработка страницы с профилем (не кешируем, т.к. не статична)
  const user = await getUserById(req.user.id);

  res.render('profile', {user,
    success: req.query.success
  })});

// Кеширование данных форм
let inputDataCache = [];                                // хранилище внутри оперативки для полученной информации
setInterval(async () => {                               // асинхронная функция для сохранения данных из оперативнки в файл
  if (inputDataCache.length > 0) {                      // если хранилище не пустое, то сохраняем в файл
    await saveDataToFile(inputDataCache, PATHS.JSON.USER_INPUT);
    inputDataCache = [];
  }
}, 1 * 60 * 1000);                                      // Сохраняем раз в 1 минуту


app.post('/inputData', async (req, res, next) => {
  console.log(req.body);
  if (!req.body) {
    const err = new Error('Отсутствуют данные формы');
    err.status = 400;                                   // Устанавливаем статус 400
    return next(err);                                   // Передаем в централизованный обработчик
  }
  
  try {
    inputDataCache.push(req.body); 
    res.redirect('/input?success=1');
  } catch (err) {
    next(err);
  }
})  

app.post('/login', (req, res, next) => {// обработка авторизации
  passport.authenticate('local', (err, user) => {
    if (err){
      return next(err);
    }
    if (!user){
      const errorMessage ='Ошибка логина или пароля';

      // Кодируем сообщение для URL (чтобы избежать проблем с пробелами и спецсимволами)
      const encodedMessage = encodeURIComponent(errorMessage);

      return res.redirect(`/login?error=${encodedMessage}`)
    }
    req.logIn(user, (err) =>{
      if (err){
        return next(err);
      }
      return res.redirect('/profile')
    })
  })(req, res, next); 
});

app.post('/logout', (req, res, next) =>{                // выход из учётки
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

app.post('/registr', async(req, res, next) => {         // регистрация
  console.log(req.body);
  if (!req.body) {
    const err = new Error('Отсутствуют данные формы');
    err.status = 400;                                   // Устанавливаем статус 400
    return next(err);                                   // Передаем в централизованный обработчик
  }
  
  try {

    const newUser = await saveUserToFile(req.body);     // сохраняем данные профиля в базе

    req.login(newUser, (err) => {                       // сразу заходим в профиль (авторизируемся)
      if (err) return next(err);
      console.log(newUser);
      return res.redirect('/profile');
    });

  } catch (err) {
    next(err);
  }
});

// Добавляем новый PUT для изменения пароля
app.put('/update-password', auth, async (req, res, next) => {
  try{
    await User.update(
      { password: req.body.newPassword }, // Новые данные
      { where: { id: req.user.id } }      // Условие поиска
    );
    return res.redirect('/profile?success=1');
  }catch (err){
    return next(err);
  }
});

app.delete('/delete-user', auth, async (req, res, next) =>{
  try {
    await User.destroy({
    where: { id: req.user.id } // Условие для удаления
    });

    // Разлогиниваем пользователя после удаления
    req.logout(function(err) {
    if (err) { return next(err); }
      res.redirect('/');
    });

    }catch (error) {
      return next(error)
    }
})

app.use((req, res, next) => {                           // обработка 404 ошибки (не найден)
  res.status(404).render('error', { 
    error: 404,
    message: 'Запрошенная страница не существует'
  });
});

app.use((err, req, res, next) => {                      // обработка 500 и 400 ошибки
  console.error(err.stack);
  const status = err.status || 500;                     // статус ошибки

  let message;

  const errorMessage = `${new Date().toISOString()} [ERROR ${status}] ${err.message}\n${err.stack || ''}\n`;
  log_stream.write(errorMessage);                       // логирование ошибки 

  if (status === 400){
    message = 'Некорректный запрос: ' + err.message;
  } else {
    message = 'Сервер лег :-(';
  }

  res.status(status).render('error', {
    error: status,
    message: message
  });
});

app.listen(process.env.PORT || port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});