const express = require ('express');
const Promise = require('bluebird');
const hbs = require('hbs');
const session = require('express-session');
const bcrypt = require("bcrypt");
const pgp = require('pg-promise')({

  promiseLib: Promise
});
const bodyParser = require('body-parser');
const app = express();

//body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

app.use(session({
    secret: 'qwertycat',
    cookie: {
        maxAge: 60000
    }
}));

const dbconfig = require('./config');
const db = pgp(dbconfig);

app.get('/sign_up', function(req, res){
    res.render('signup.hbs');

});

app.post('/sign_up_submit', function(req, res, next){
    console.log('sign_up_submit');
    const username = req.body.username;
    const password = req.body.password;

    bcrypt.hash(password, 10)
    .then(function(hashedPassword){

        return db.one(`insert into login (id, username, password) values (default, $1, $2)`, [username, hashedPassword])
    })
    .then(function(){
        req.session.loggedInUser = username.username;
        res.redirect('/')
        console.log("Data Inserted");
    })
    .catch(next);
    res.redirect('/sign_up_submit');
});

//view engine middleware
app.set('view engine', 'hbs');

app.use(function(req, res, next) {
  res.locals.session = req.session;
  next();
});

app.get('/login', function(req, res){
    res.render('login.hbs');
});

app.post("/submit_login", function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  console.log(username, password);

  //1. get user name and password from form
  //2. get encrypted password from the login table
  //3. compare encrypted password with plain password
  //4. if match
  //   * log them in saving their name into session
  //   * else redirect to login page

  db.one(`
    select * from login where
     username = $1
   `, [username])
      .then(function(result){
          return bcrypt.compare(password, result.password);
      })
      .then(function(matched){
          if (matched) {
              req.session.loggedInUser = username;
              res.redirect('/');
          }
              else{
                  res.redirect('login');
              }
          })
      });

//home page path
app.get('/', function(req,res){
    res.render('search.hbs');
    });

// submit search path
app.get('/search',function(req,res, next){
    let term = req.query.search;
    console.log('Term', term);
    db.any(`select * from restaurant where restaurant.name ilike '%${term}%'`)
    .then(function(resultsArray){
        //console.log('results', resultsArray);
        res.render('search_results.hbs', {
            result: resultsArray
        });
    })
    .catch(next);
});

//restaurant page path
app.get('/restaurant/:id', function(req, res, next){
    let restaurantid = req.params.id;
    db.any(`
        select
          reviewer.name as reviewer_name,
          review.title,
          review.stars,
          review.review
        from
          restaurant
        inner join
          review on review.restaurantid = restaurant.restaurantid
        inner join
          reviewer on review.reviewerid = reviewer.reviewerid
        where restaurant.restaurantid = ${restaurantid}`)

    .then(function(reviews){
        return [
            reviews,
            db.one(`select name, address from restaurant where restaurantid = ${restaurantid}`)
        ]
    })
    .spread(function(reviews, restaurant) {
        var add = restaurant.address.replace(/\s/g, "+");
        var url = "https://www.google.com/maps/embed/v1/place?key=AIzaSyCQTSdDzTKk18aDJajHlNjH2I1E0iefwxo&q="+add;
      res.render('restaurant.hbs', {
        restaurant: restaurant,
        reviews: reviews,
        restaurant_address: add,
        url:url

      });
    })

    .catch(next);
});

app.use(function authentication(req, res, next) {
  if (req.session.loggedInUser) {
    next();
  } else {
    res.redirect('/login');
  }
});

//post review path
app.post('/submit_review/:id', function (req, res, next){
    let restaurantid = req.params.id;
    console.log('restaurant ID', id);
    console.log('from the form', req.body);
    db.none(`insert into review values
      (default, NULL, ${req.body.stars}, '${req.body.title}', '${req.body.review}', ${restaurantid})`)
      .then(function() {
        res.redirect(`/restaurant/${restaurantid}`);
      })
      .catch(next);
  });

app.listen(3000, function() {
    console.log('Example app listening on port 3000!');
});

//AIzaSyDJ7A4c-KnsM0SPzWDvsyAL5sv357R_6aQ (google maps key)
