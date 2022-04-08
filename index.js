import { neru } from 'neru-alpha';
import hpm from 'http-proxy-middleware';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import parsePhoneNumber from 'libphonenumber-js'
import isoCountry from "i18n-iso-countries";
import cons from 'consolidate';
import cel from "connect-ensure-login"
import csrf from "csurf";
import e_session from "express-session"
import cookieParser from "cookie-parser";
import { passport_auth, passport } from "./passport-strategy.js"
import flash from "express-flash";
import 'dotenv/config'
const application_id = process.env["API_APPLICATION_ID"]
const api_key = process.env['API_ACCOUNT_ID']

var ensureLoggedIn = cel.ensureLoggedIn
passport_auth(application_id, api_key)

const __dirname = dirname(fileURLToPath(import.meta.url));
var path = __dirname + '/views/';
const { createProxyMiddleware, fixRequestBody, Filter, Options, RequestHandler } = hpm;

//You actually don't need neru router, just use your own
//const router = neru.Router()
const router = express.Router()


// use bodyParser if not using neru
// You can leave this here even if using neru. neru will declare this when loading it's own Express
import bodyParser from 'body-parser';
router.use(bodyParser.urlencoded());

/*>>>> IF Standalone: use standalone redis *****/

// import { createClient } from 'redis';
// const instanceState = createClient();

// instanceState.on('error', (err) => console.log('Redis Client Error', err));

// await instanceState.connect();

/*<<<< ENDIF Standalone *****/

/*>>>> IF NERU: use Neru Session *****/

const session = neru.getSessionById('neru-sms-proxy-' + application_id);
const instanceState = session.getState();

/*<<<< ENDIF NERU *****/

//fsetup standard cookies and sessions
router.use(cookieParser());
router.use(e_session({
    secret: 'keyboard cat',
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
}));

router.use(flash());
router.use(passport.authenticate('session'));
router.use(function (req, res, next) {
    try {
        res.locals.csrfToken = req.csrfToken();
    } catch (e) {
        //nothing
    }
    next();
});

//load the css, js, fonts to static paths so it's easier to call in template
router.use("/fonts", express.static(join(__dirname, "node_modules/bootstrap/fonts")));
router.use("/css", express.static(join(__dirname, "node_modules/bootstrap/dist/css")));
router.use("/css", express.static(join(__dirname, "node_modules/bootstrap-select/dist/css")));
router.use("/css", express.static(join(__dirname, "node_modules/bootstrap-select-country/dist/css")));
router.use("/js", express.static(join(__dirname, "node_modules/bootstrap/dist/js")));
router.use("/js", express.static(join(__dirname, "node_modules/bootstrap-select/dist/js")));
router.use("/js", express.static(join(__dirname, "node_modules/bootstrap-select-country/dist/js")));
router.use("/js", express.static(join(__dirname, "node_modules/jquery/dist")));

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
            //this happens because neru loads body parser and changes the body to json instead of the default form paramas that rest.nexmo needs
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
    cons.ejs(path + "conf.ejs", { blacklist_selected: blacklist_selected, blacklist_with_name: blacklist_with_name, user: req.user, csrfToken: req.csrfToken() }, function (err, html) {
        if (err) throw err;
        res.send(html);
    });
});


router.get('/login', csrf(), function (req, res, next) {
    cons.ejs(path + "login.ejs", { csrfToken: req.csrfToken(), messages: req.flash("error") }, function (err, html) {
        if (err) throw err;
        res.send(html);
    });
});

router.post('/login', csrf(), passport.authenticate('local', {
    successReturnToOrRedirect: './conf',
    failureRedirect: './login',
    failureFlash: true
}));


router.post('/logout', function (req, res, next) {
    req.logout();
    res.redirect('./login');
});

router.get('/logout', function (req, res, next) {
    req.logout();
    res.redirect('./');
});



/*>>>> IF STANDALONE: Use Own Express ******/

// const app = express()
// const port = 3001
// console.log(process.env)
// app.use(router)
// app.listen(port, () => {
//     console.log(`App listening on port ${port}`)
// })

/*<<<< ENDIF Standalone *****/

/*>>>> IF NERU: use Neru's Express *****/

export { router };

/*<<<< ENDIF NERU *****/