import { neru, State } from 'neru-alpha';
import hpm from 'http-proxy-middleware';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

import cel, { ensureLoggedOut } from "connect-ensure-login"
import cookieSession from "cookie-session"
import cookieParser from "cookie-parser";
import { passport_auth, passport } from "./passport-strategy.js";
import flash from "express-flash";
import 'dotenv/config';
import  { CountryBlacklist }  from "./filters/countryblacklist.js"
import  { NumberModule }  from "./filters/number_module.js"
import cors from 'cors';
import bodyParser from 'body-parser';
import pg from 'pg';
import Vonage from '@vonage/server-sdk';
// pools will use environment variables
// for connection information
const pool = new pg.Pool()
const debug = process.env.DEBUG || false;
// function ensureLoggedIn(options) {
//     if (typeof options == 'string') {
//         options = { redirectTo: options };
//     }
//     options = options || {};
  
//     var url = options.redirectTo || '/login';
//     var setReturnTo = (options.setReturnTo === undefined) ? true : options.setReturnTo;
  
//     return function (req, res, next) {
//         if (!req.isAuthenticated || !req.isAuthenticated()) {
//             if (setReturnTo && req.session) {
//                 req.session.returnTo = req.originalUrl || req.url;
//             }
//             res.clearCookie('session', {path: '/'});
//             return res.redirect(301, url);
//         }
//         next();
//     };
//   };

var octo_logger = async function (req, res, next){
    var api_key = req.body.api_key
    var from = ''
    if(req.body.from) from = req.body.from
    var to = ''
    if(req.body.to) from = req.body.to
    var others = '[]'
    others = JSON.stringify(req.body)
    const text = 'INSERT INTO octopuslog(api_key, data_from, data_to, other_params) VALUES($1, $2, $3, $4) RETURNING *'
    const values = [api_key, from, to, others]
    try {
        const result = await pool.query(text, values)
        console.log(result.rows[0])
        req.octo_logid = result.rows[0]['id']
        // { name: 'brianc', email: 'brian.m.carlson@gmail.com' }
      } catch (err) {
        console.log(err)
      }
    next()
};
var validator = async function (req, res, next){
    console.log("Validate")
    var api_key = req.body.api_key
    var api_secret = req.body.api_secret
    console.log(">>>:", api_key, api_key == "octo")

    if (debug){
        if (api_key == "octo"){
            console.log("skip")
            return next()
        }
    }
    

    const vonage = new Vonage({
        apiKey: api_key,
        apiSecret: api_secret
    });

    await vonage.account.listSecrets(api_key, async (err, result) => {
        if (!err) {
            //Valid API Secret, Let's go
            next()
        } else {
            res.status(403).json({"Error":"Authentication Failed","message":"Check you API KEY and API SECRET"});
            return
        }
    });
};


const __dirname = dirname(fileURLToPath(import.meta.url));
const views_path = __dirname + '/views/';
const { createProxyMiddleware, fixRequestBody, Filter, Options, RequestHandler } = hpm;

var api_key = "";
const port = process.env.NERU_APP_PORT || 3001;
var session = neru.getSessionById("zzbeejay");
const globalstate = new State(session);
const numbermodule = new NumberModule(globalstate, pool);
const countryblacklist = new CountryBlacklist(globalstate);


var ensureLoggedIn = cel.ensureLoggedIn 
//if debug, ensuredLoggedIn does nothing
if (debug){
    ensureLoggedIn = (options) => {
        return function (req, res, next) {
            next()
        };
    }
}



passport_auth() //calls pasport.use
const app = express()
app.set('view engine', 'ejs');
app.use(cors());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(flash());
app.use(cookieSession({
    name: 'session',
    keys: ["secretcat"],
    secure: false,
    resave: false,
    // Cookie Options
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }))
app.use(passport.authenticate('session'));


//load the css, js, fonts to static paths so it's easier to call in template
app.use("/fonts", express.static(join(__dirname, "node_modules/bootstrap/fonts")));
app.use("/css", express.static(join(__dirname, "node_modules/bootstrap-latest/dist/css")));
app.use("/bootstrap-3.3.7-css", express.static(join(__dirname, "node_modules/bootstrap/dist/css")));
app.use("/css", express.static(join(__dirname, "node_modules/bootstrap-select/dist/css")));
app.use("/css", express.static(join(__dirname, "node_modules/bootstrap-select-country/dist/css")));
app.use("/bootstrap-3.3.7-js", express.static(join(__dirname, "node_modules/bootstrap/dist/js")));
app.use("/js", express.static(join(__dirname, "node_modules/bootstrap-latest/dist/js")));
app.use("/js", express.static(join(__dirname, "node_modules/bootstrap-select/dist/js")));
app.use("/js", express.static(join(__dirname, "node_modules/bootstrap-select-country/dist/js")));
app.use("/js", express.static(join(__dirname, "node_modules/jquery-time-duration-picker/dist")));
app.use("/jqui", express.static(join(__dirname, "node_modules/jquery-ui/dist")));
app.use("/js", express.static(join(__dirname, "node_modules/jquery/dist")));
app.use("/numbers",numbermodule.router)
app.use("/country",countryblacklist.router)

app.use('/sms',
    //custom middleware to check if "to" is blacklisted
    [countryblacklist.blacklist_to],
    //http proxy middleware
    createProxyMiddleware({
        target: 'https://rest.nexmo.com', changeOrigin: true,
        onProxyReq: (proxyReq, req, res) => {
            fixRequestBody(proxyReq, req); //this fixes the body to orignal format before modifed by body-parer
            //this happens because neru loads body parser and changes the body to json instead of the default form paramas that rest.nexmo needs
        }

    })
)



app.post('/octopus',
    validator,
    octo_logger,
    numbermodule.whitelist_from,
    numbermodule.blacklist_from,
    numbermodule.auto_rate_block,
    numbermodule.auto_block_duration,

    //custom middleware to check if "to" is blacklisted
    // [countryblacklist.blacklist_to],
    // [countryblacklist.blacklist_from],
    //[numbermodule.blacklist_from],
    async (req, res) => {
        const text = 'update octopuslog set allowed=true where id = $1'
        const values = [req.octo_logid]
        pool.query(text, values, (err, res) => {
            if (err) {
              console.log(err.stack)
            } else {
              console.log(res.rows[0])
            }
          })
        res.json({"allowed":true,"log_id":req.octo_logid})
        return
    }
)

app.get('/_/health', async (req, res) => {
    res.sendStatus(200);
});

//see if service is live
app.get('/', async (req, res, next) => {
    res.redirect('./login');
});

app.get('/conf', function (req, res, next) {
    var prefix = "octo"
    if (req.user){
        prefix=req.user.username
    }
    res.render(views_path + "conf.ejs", {user: prefix})

});

app.get('/login', function (req, res, next) {
    res.render(views_path + "login.ejs", { messages: req.flash("error") })

});

app.post('/login',  passport.authenticate('local', {
    successRedirect: "./conf",
    failureRedirect: './login',
    failureFlash: true
}));


app.post('/logout', function (req, res, next) {
    res.clearCookie('session', {path: '/'});
    res.redirect('./login');
});

app.get('/logout', function (req, res, next) {
    res.clearCookie('session', {path: '/'});
    res.redirect('./login');
});


console.log(process.env)
app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})
