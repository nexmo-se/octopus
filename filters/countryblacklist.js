import parsePhoneNumber from 'libphonenumber-js'
import express from 'express';
import isoCountry from "i18n-iso-countries";
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import cel from "connect-ensure-login"
const __dirname = dirname(fileURLToPath(import.meta.url));
const views_path = __dirname + '/../views/';
const ensureLoggedIn = cel.ensureLoggedIn

export function CountryBlacklist(state){
  this.router = express.Router();

  this.blacklist_to = function (req, res, next){
    var prefix = req.body.api_key
    state.get(prefix+"blacklist").then((blacklist) => {
        if (!blacklist) {
            next();
        }
        else {
          if (!req.body.to) {next()}
            const phoneNumber = parsePhoneNumber("+" + (req.body.to));
            blacklist = JSON.parse(blacklist);
            if (blacklist.includes(phoneNumber.country)) {
              res.json({"allowed":false,"message":"Country in Blocked List"});
              return
            }
            else {
                next();
            }
        }
    });

  }

  this.blacklist_from = function (req, res, next){
    var prefix = req.body.api_key
    state.get(prefix+"blacklist").then((blacklist) => {
        if (!blacklist) {
            next();
        }
        else {
            console.log("FROM",req.body.from, !req.body.from)
            if (!req.body.from) {next()
            }
            const phoneNumber = parsePhoneNumber("+" + (req.body.from));
            blacklist = JSON.parse(blacklist);
            try{
              if (blacklist.includes(phoneNumber.country)) {
                res.json({"allowed":false,"message":"Country in Blocked List"});
                return
              }
              else {
                  next();
              }
            }catch(e){
              next();
            }
            
            
        }
    });

  }

  this.number_block = function (req, res, next){
    if(req.body.to == "6598629551"){
      res.status(403).send("Number is blocked");
    }else{
      next();
    }   
  };

  //Set Blacklist
  this.router.post('/set_blacklist', async (req, res, next) => {
    var prefix = "octo"
    if (req.user){
        prefix=req.user.username
    }
    var blacklist = req.body.data
    if (!blacklist) blacklist = [];
    await state.set(prefix+"blacklist", JSON.stringify(blacklist));
    blacklist = blacklist.map(i => i + ": " + isoCountry.getName(i, "en", { select: "official" }));
    res.status(200).send(blacklist)
  });

  //Get Blacklist
  this.router.get('/blacklist', async (req, res, next) => {
    var prefix = "octo"
    if (req.user){
        prefix=req.user.username
    }
    var blacklist = await state.get(prefix+"blacklist");
    res.send(JSON.parse(""))
  });

  //Load Conf page
  //this.router.get('/conf', async (req, res, next) => {
  this.router.get('/conf', ensureLoggedIn("../login"), async (req, res, next) => {
    //use consolidate js to load ejs file since we don't have access to express
    var prefix = "octo"
    if (req.user){
        prefix=req.user.username
    }
    console.log("Prefix:",prefix)
    var blacklist = await state.get(prefix+"blacklist");
    if (!blacklist) blacklist = "[]";
    blacklist = JSON.parse(blacklist);
    var blacklist_selected = blacklist.join(",");
    var blacklist_with_name = blacklist.map(i => i + ": " + isoCountry.getName(i, "en", { select: "official" }));
    res.render(views_path + "country_conf.ejs", { blacklist_selected: blacklist_selected, blacklist_with_name: blacklist_with_name, user: prefix })
    //console.log(req)
    //res.render(views_path + "conf.ejs", { blacklist_selected: blacklist_selected, blacklist_with_name: blacklist_with_name, user: "test"})
  });

}