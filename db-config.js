import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize({
  database: process.env.DB_NAME || 'my_db',                    // имя БД: берём из контейнера при наличии
  username: process.env.DB_USER || 'app_user',                 // пользователь: берём из контейнера при наличии
  password: process.env.DB_PASSWORD || 'db_user_password',     // пароль: берём из контейнера при наличии   
  host: process.env.DB_HOST || 'localhost',                    // берём хост для базы данных (где находится PostgreSQL-сервер)
                                                               // в случае рабботы с докером хостом является название соответствующего контейнера                        
  dialect: 'postgres',
  logging: false,
  define: {
    schema: 'public'
  },
  dialectOptions: {
    prependSearchPath: true
  }
});