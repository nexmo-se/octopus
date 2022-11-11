import { neru, State } from 'neru-alpha';
import hpm from 'http-proxy-middleware';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import isoCountry from "i18n-iso-countries";
import cel from "connect-ensure-login"
import cookieSession from "cookie-session"
import cookieParser from "cookie-parser";
import { passport_auth, passport } from "./passport-strategy.js";
import flash from "express-flash";
import 'dotenv/config';
import  { CountryBlacklist }  from "./filters/countryblacklist.js"
import  { NumberModule }  from "./filters/number_module.js"
import cors from 'cors';
import bodyParser from 'body-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const views_path = __dirname + '/views/';
const { createProxyMiddleware, fixRequestBody, Filter, Options, RequestHandler } = hpm;

var api_key = "";
const port = process.env.NERU_APP_PORT || 3001;
var session = neru.getSessionById("zzbeejay");
const globalstate = new State(session);
const numbermodule = new NumberModule(globalstate);
const countryblacklist = new CountryBlacklist(globalstate);
const ensureLoggedIn = cel.ensureLoggedIn


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
app.use("/css", express.static(join(__dirname, "node_modules/bootstrap/dist/css")));
app.use("/css", express.static(join(__dirname, "node_modules/bootstrap-select/dist/css")));
app.use("/css", express.static(join(__dirname, "node_modules/bootstrap-select-country/dist/css")));
app.use("/js", express.static(join(__dirname, "node_modules/bootstrap/dist/js")));
app.use("/js", express.static(join(__dirname, "node_modules/bootstrap-select/dist/js")));
app.use("/js", express.static(join(__dirname, "node_modules/bootstrap-select-country/dist/js")));
app.use("/js", express.static(join(__dirname, "node_modules/jquery/dist")));

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

app.use("/numbers",numbermodule.router)

app.all('/octopus',
    //custom middleware to check if "to" is blacklisted
    // [countryblacklist.blacklist_to],
    // [countryblacklist.blacklist_from],
    [numbermodule.blacklist_from],
    async (req, res) => {
        res.send('{"allowed":true}')
        return
    }
)

app.get('/_/health', async (req, res) => {
    res.sendStatus(200);
});

//see if service is live
app.get('/', async (req, res, next) => {
    res.send("Vonage Proxy Service");
});

//Set Blacklist
app.post('/set_blacklist', async (req, res, next) => {
    var prefix = "octo"
    if (req.user.username){
        prefix=req.user.username
    }
    var blacklist = req.body.data
    if (!blacklist) blacklist = [];
    await globalstate.set(prefix+"blacklist", JSON.stringify(blacklist));
    blacklist = blacklist.map(i => i + ": " + isoCountry.getName(i, "en", { select: "official" }));
    res.status(200).send(blacklist)
});

//Get Blacklist
app.get('/blacklist', async (req, res, next) => {
    var prefix = "octo"
    if (req.user.username){
        prefix=req.user.username
    }
    var blacklist = await globalstate.get(prefix+"blacklist");
    res.send(JSON.parse(""))
});

//Load Conf page
//app.get('/conf', async (req, res, next) => {
app.get('/conf', ensureLoggedIn("./login"), async (req, res, next) => {
    //use consolidate js to load ejs file since we don't have access to express
    var prefix = "octo"
    if (req.user.username){
        prefix=req.user.username
    }
    console.log("Prefix:",prefix)
    var blacklist = await globalstate.get(prefix+"blacklist");
    if (!blacklist) blacklist = "[]";
    blacklist = JSON.parse(blacklist);
    var blacklist_selected = blacklist.join(",");
    var blacklist_with_name = blacklist.map(i => i + ": " + isoCountry.getName(i, "en", { select: "official" }));

    var numblacklist = await globalstate.get(prefix+"number_blacklist");
    if (!numblacklist) numblacklist = "[]";
    numblacklist = JSON.parse(numblacklist);
    res.render(views_path + "conf.ejs", { blacklist_selected: blacklist_selected, blacklist_with_name: blacklist_with_name, num_blacklist: numblacklist, user: prefix })
    //console.log(req)
    //res.render(views_path + "conf.ejs", { blacklist_selected: blacklist_selected, blacklist_with_name: blacklist_with_name, user: "test"})
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
