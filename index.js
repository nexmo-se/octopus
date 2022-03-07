import { neru } from 'neru-alpha';
import Vonage from '@vonage/server-sdk';
import hpm from 'http-proxy-middleware';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import st from 'serve-static';
import parsePhoneNumber from 'libphonenumber-js'
import isoCountry from "i18n-iso-countries";
import cons from 'consolidate';
import cel from "connect-ensure-login"
import passport from "passport";
import LocalStrategy from "passport-local";
import csrf from  "csurf";
import e_session from "express-session"
import cookieParser from "cookie-parser";
// import connectSqlite3 from 'connect-sqlite3';
import flash from "express-flash";
// const SQLiteStore = connectSqlite3(e_session);

var ensureLoggedIn = cel.ensureLoggedIn

passport.use(new LocalStrategy(function verify(appID, apiSecret, cb) {
    if (process.env["API_APPLICATION_ID"] != appID) { return cb(null, false, { message: 'Incorrect username or password.' }); }
    
    const apiKey = process.env['API_ACCOUNT_ID']
    const vonage = new Vonage({
        apiKey: apiKey,
        apiSecret: apiSecret
    });
    
    vonage.account.listSecrets(apiKey, (err, result) => {
      if (!err) {
          //Valid API Secret, Let's go
        return cb(null, {id:"0", username:"Vonage User"})
      }else{
        return cb(null, false, { message: 'Incorrect username or password.' })
      }
    });
}));

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      cb(null, { id: user.id, username: user.username });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

//emulate js __dirname as we are in es6
const __dirname = dirname(fileURLToPath(import.meta.url));
var path = __dirname + '/views/';
const app_id = process.env['API_APPLICATION_ID']; //get application_id
const api_key = process.env['API_ACCOUNT_ID']; //get api key
const { createProxyMiddleware, fixRequestBody, Filter, Options, RequestHandler } = hpm;
const router = neru.Router();
const session = neru.getSessionById('neru-sms-proxy-' + app_id);
const instanceState = session.getState();


router.use(cookieParser());
router.use(e_session({
  secret: 'keyboard cat',
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
//   store: new SQLiteStore({ db: 'sessions.db', dir: './' })
}));
//router.use(csrf());
router.use(flash());
router.use(passport.authenticate('session'));
router.use(function(req, res, next) {
  try{
    res.locals.csrfToken = req.csrfToken();  
  }catch(e){
      //nothing
  }
    

  next();
});

//load the css, js, fonts to static paths so it's easier to call in template
router.use("/fonts", st(join(__dirname, "node_modules/bootstrap/fonts")));
router.use("/css", st(join(__dirname, "node_modules/bootstrap/dist/css")));
router.use("/css", st(join(__dirname, "node_modules/bootstrap-select/dist/css")));
router.use("/css", st(join(__dirname, "node_modules/bootstrap-select-country/dist/css")));
router.use("/js", st(join(__dirname, "node_modules/bootstrap/dist/js")));
router.use("/js", st(join(__dirname, "node_modules/bootstrap-select/dist/js")));
router.use("/js", st(join(__dirname, "node_modules/bootstrap-select-country/dist/js")));
router.use("/js", st(join(__dirname, "node_modules/jquery/dist")));

router.use('/sms',
    //custom middleware to check if "to" is blacklisted
    (req, res, next) => {
        instanceState.get("blacklist").then((blacklist) => {
            if (!blacklist) {
                next();
            }
            else {
                const phoneNumber = parsePhoneNumber("+" + (req.body.to));
                blacklist = JSON.parse(blacklist);
                if (blacklist.includes(phoneNumber.country)) {
                    res.status(403).send("Country in Blocked List");
                }
                else {
                    next();
                }
            }
        });

    },
    //http proxy middleware
    createProxyMiddleware({
        target: 'https://rest.nexmo.com', changeOrigin: true,
        onProxyReq: (proxyReq, req, res) => {
            fixRequestBody(proxyReq, req); //this fixes the body to orignal format before modifed by body-parer
        }

    })
)


//see if service is live
router.get('/', async (req, res, next) => {
    res.send("Vonage Proxy Service");
});

//Set Blacklist
router.post('/set_blacklist', csrf(), async (req, res, next) => {
    var blacklist = req.body.data
    if (!blacklist) blacklist = [];
    await instanceState.set("blacklist", JSON.stringify(blacklist));
    blacklist = blacklist.map(i => i + ": " + isoCountry.getName(i, "en", { select: "official" }));
    res.status(200).send(blacklist)
});

//Get Blacklist
router.get('/blacklist', async (req, res, next) => {
    var blacklist = await instanceState.get("blacklist");
    res.send(JSON.parse(blacklist))
});

//Load Conf page
router.get('/conf', csrf(), ensureLoggedIn("./login"), async (req, res, next) => {
    //use consolidate js to load ejs file since we don't have access to express
    var blacklist = await instanceState.get("blacklist");
    if (!blacklist) blacklist = "[]";
    blacklist = JSON.parse(blacklist);
    var blacklist_selected = blacklist.join(",");
    var blacklist_with_name = blacklist.map(i => i + ": " + isoCountry.getName(i, "en", { select: "official" }));
    cons.ejs(path + "conf.ejs", { blacklist_selected: blacklist_selected, blacklist_with_name: blacklist_with_name, user: req.user, csrfToken: req.csrfToken()}, function (err, html) {
        if (err) throw err;
        res.send(html);
    });
});


router.get('/login', csrf(), function (req, res, next) {
    cons.ejs(path + "login.ejs", {csrfToken: req.csrfToken(), messages : req.flash("error")}, function (err, html) {
        if (err) throw err;
        res.send(html);
    });
});

router.post('/login', csrf(), passport.authenticate('local', {
    successReturnToOrRedirect: './conf',
    failureRedirect: './login',
    failureFlash: true
}));


router.post('/logout', csrf(), function (req, res, next) {
    req.logout();
    res.redirect('./login');
});

router.get('/logout', csrf(), function (req, res, next) {
    req.logout();
    res.redirect('./');
});


export { router };