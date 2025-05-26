import passport from 'passport';                                // подключение модуля passport - аутентификация
import { Strategy as LocalStrategy } from 'passport-local';     // подключение модуля passport-local - локальная стратегияif
import { sequelize } from './db-config.js';
import { DataTypes } from 'sequelize';

const User = sequelize.define('User', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  name: DataTypes.STRING,
  password: DataTypes.STRING,
  time_to_get: {
    type: DataTypes.DATE,
    defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
  }
}, { 
  timestamps: false,
  tableName: 'users'            // Явное указание имени таблицы
});

sequelize.authenticate()        // проверка на подключение sql
  .then(() => console.log('PostgreSQL connected'))
  .catch(err => console.error('PostgreSQL connection error:', err));

sequelize.sync({ force: false, alter: true })
  .then(() => console.log('Все таблицы синхронизированы'))
  .catch(err => console.error('Ошибка синхронизации:', err));

passport.serializeUser(function (user, done){
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const user = await User.findByPk(id);              // Поиск по PRIMARY KEY
    done(null, user || false);
});

passport.use(
    new LocalStrategy(async (username, password, done) => {

        const user = await User.findOne({ where: { name: username } }); // поиск пользлвателя в db

        if (!user){
            return done (null, false)               // если пользователся не наши 
        }

        if (password === user.password){
            return done (null, user)
        } else {
            return done (null, false)
        }
    })
)

export { User };