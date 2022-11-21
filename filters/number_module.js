import parsePhoneNumber from 'libphonenumber-js'
import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import cel from "connect-ensure-login"
const __dirname = dirname(fileURLToPath(import.meta.url));
const views_path = __dirname + '/../views/';
const ensureLoggedIn = cel.ensureLoggedIn
//octopusdb password: B9FN5thmgloOjStDxnrB

export function NumberModule(state, pool){
  this.router = express.Router();
  
  this.blacklist_from = function (req, res, next){
    var prefix = req.body.api_key
    state.get(prefix+"number_blacklist").then((nblacklist) => {
        if (!nblacklist) {
          next();
        }
        else {
          const phoneNumber = parsePhoneNumber("+" + (req.body.from));
          nblacklist = JSON.parse(nblacklist);
          var number = parseInt(phoneNumber.number.replace("+",""))

          for (const nrange of nblacklist) {
            console.log(nrange)
            if(number >= nrange[0] && number <= nrange[1]){
              res.status(200).json({"allowed":false,"message":"number in Black List"});
              return
            }
          }
          // nblacklist.forEach(nrange => {
            
          // });
          next();
        }
    });

  }

  this.whitelist_from = function (req, res, next){
    var prefix = req.body.api_key
    state.get(prefix+"number_whitelist").then((nwhitelist) => {
        console.log("whitelist", nwhitelist )
        if (!nwhitelist) {
          next();
        }
        else {
          const phoneNumber = parsePhoneNumber("+" + (req.body.from));
          nwhitelist = JSON.parse(nwhitelist);
          var number = parseInt(phoneNumber.number.replace("+",""))
          for (const nrange of nwhitelist) {
            console.log(nrange)
            if(number >= nrange[0] && number <= nrange[1]){
              res.json({"allowed":true,"message":"number in White List"});
              return
            }
          }
          next();
        }
    });

  }


  this.auto_rate_block = async function (req, res, next){
    console.log("autorate")
    var prefix = req.body.api_key
    state.get(prefix+"auto_blacklist_threshold").then(async (data) => {
      if (!data) {
        console.log("No Auto Rate Threshold")
        next();
      }
      else{
        if (!req.body.from) {next()}
        var threshold = JSON.parse(data);
        var range = parseInt(threshold["range"])||0
        var time = threshold["time"]||0
        var limit = threshold["limit"]||9999999

        var calc = req.body.from
        if (range>0) calc = req.body.from.slice(0,(range*-1))+("_".repeat(range))
        
        

        try {
          const text = `select count(id) from octopuslog where data_from like '${calc}' and api_key = '${prefix}' and  created_at between now() - interval '${time} seconds' and now();`
          console.log(text)
          const result = await pool.query(text)
          console.log(result.rows[0])
          var count = result.rows[0]['count']
          if (count >= parseInt(limit)){
            res.json({"allowed":false,"message":"number range in auto limit list"});
            return
          }
        } catch (err) {
          console.log(err)
          next();
        }
        next()
      }
      
    });
    
  };

  //Load Conf page
  //this.router.get('/conf', async (req, res, next) => {
  this.router.get('/conf', ensureLoggedIn("../login"), async (req, res, next) => {
    //use consolidate js to load ejs file since we don't have access to express
    var prefix = "octo"
    if (req.user){
        prefix=req.user.username
    }

    var threshold = await state.get(prefix+"auto_blacklist_threshold");
    if (!threshold){threshold= {"range":0,"limit":0,"time":0};}
    else{threshold = JSON.parse(threshold) }
    var numblacklist = await state.get(prefix+"number_blacklist");
    if (!numblacklist) numblacklist = "[]";
    numblacklist = JSON.parse(numblacklist);

    var numwhitelist = await state.get(prefix+"number_whitelist");
    if (!numwhitelist) numwhitelist = "[]";
    numwhitelist = JSON.parse(numwhitelist);
    
    console.log(threshold)
    res.render(views_path + "number_conf.ejs", { num_blacklist: numblacklist, num_whitelist: numwhitelist, user: prefix, threshold: threshold })
    //console.log(req)
    //res.render(views_path + "conf.ejs", { blacklist_selected: blacklist_selected, blacklist_with_name: blacklist_with_name, user: "test"})
  });

    //Get Blacklist
    this.router.get('/get_auto_blacklist', async (req, res, next) => {
      var prefix = "octo"
      if (req.user){
          prefix=req.user.username
      }


      var threshold = await state.get(prefix+"auto_blacklist_threshold");
      if (!threshold){threshold= {"range":0,"limit":0,"time":0};}
      else{threshold = (JSON.parse(threshold))}
      console.log("ThresholdFilter", threshold)
      var range = threshold.range||0
      var time = threshold.time||0
      var limit = threshold.limit||9999999
      const text = `SELECT  concat(left(data_from, length(data_from) - ${range}),'${("_".repeat(range))}') as range, count(created_at)  FROM octopuslog where api_key = '${prefix}' and created_at between now() - interval '${time} seconds' and now()   group by range having count(created_at) >=${limit}  order by count(created_at) desc`
      console.log(text)
      try {
          const result = await pool.query(text)
          console.log(result.rows[0])
          res.json({"result":result.rows, "range_modifier":range})
          return
          // { name: 'brianc', email: 'brian.m.carlson@gmail.com' }
        } catch (err) {
          console.log(err)
        }
    });


  //Set Blacklist
  this.router.post('/set_blacklist', async (req, res, next) => {
    var prefix = "octo"
    if (req.user){
        prefix=req.user.username
    }
    
    var blacklist = JSON.parse(req.body.data)
    if (!blacklist) blacklist = [];
    console.log("BLA:", blacklist[0])
    await state.set(prefix+"number_blacklist", JSON.stringify(blacklist));
    res.status(200).send(blacklist)
  });
  
    //Set Blacklist
    this.router.post('/set_whitelist', async (req, res, next) => {
      var prefix = "octo"
      if (req.user){
          prefix=req.user.username
      }
      console.log("User",prefix)
      var whitelist = JSON.parse(req.body.data)
      if (!whitelist) whitelist = [];
      console.log("BLA:", whitelist[0])
      await state.set(prefix+"number_whitelist", JSON.stringify(whitelist));
      res.status(200).send(whitelist)
    });

  //Set Range
  this.router.post('/set_threshold', async (req, res, next) => {
    if(!req.body.time) {
      res.status(400).send('Required Time Param missing');
      return
    }
    var time = req.body.time
    if(!req.body.range) {
      res.status(400).send('Required Range Param missing');
      return
    }
    var range = req.body.range
    if(!req.body.limit) {
      res.status(400).send('Required Limit Param missing');
      return
    }
    var limit = req.body.limit
    var prefix = "octo"
    if (req.user){
        prefix=req.user.username
    }
    console.log("SetThresholdUser",prefix+"auto_blacklist_threshold")
    var data = {"time":time,"range":range, "limit":limit}
    await state.set(prefix+"auto_blacklist_threshold", JSON.stringify(data));
    res.status(200).send(data)
  });

  //Set Range
  this.router.get('/get_threshold', async (req, res, next) => {
    var prefix = "octo"
    if (req.user){
        prefix=req.user.username
    }
    console.log("GetThresholdUser",prefix+"auto_blacklist_threshold")
    var threshold = await state.get(prefix+"auto_blacklist_threshold");
    res.status(200).json(JSON.parse(threshold))
  });

  // Home page route.
  this.router.get("/", function (req, res) {
    res.send("Wiki home page");
  });
  
  // About page route.
  this.router.get("/about", function (req, res) {
    res.send("About this wiki");
  });
}