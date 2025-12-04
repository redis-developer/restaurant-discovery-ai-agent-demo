import http from 'http';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { create } from 'express-handlebars';

import CONFIG from './config.js';
import { handleError } from './lib/errors.js';

import indexRouter from './services/routes/index.js';
// New service-based routes
import reservationRouter from './services/reservations/api/reservation-routes.js';
import chatRouter from './services/chat/api/chat-routes.js';
import restaurantRouter from './services/restaurants/api/restaurant-routes.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Create Handlebars instance with helpers
const hbs = create({
  extname: '.hbs',
  defaultLayout: false, // Disable default layout
  helpers: {
    eq: function (a, b) {
      return a === b;
    },
    repeat: function (count, options) {
      let result = '';
      for (let i = 0; i < count; i++) {
        result += options.fn(this);
      }
      return result;
    }
  }
});

// View engine setup
app.engine('.hbs', hbs.engine);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', '.hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'client')));

// Routes
app.use('/', indexRouter);
app.use('/api/reservations', reservationRouter);
app.use('/ai', chatRouter);
app.use('/api/restaurants', restaurantRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(handleError);

const server = http.createServer(app);
const port = CONFIG.serverPort;

app.set('port', port);

server.listen(port, () => {
  console.log(`🍽️ Relish server listening on port ${port}`);
});

export default app;
