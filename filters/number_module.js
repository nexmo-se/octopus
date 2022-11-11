import parsePhoneNumber from 'libphonenumber-js'
import express from 'express';
//octopusdb password: B9FN5thmgloOjStDxnrB

export function NumberModule(state){
  this.router = express.Router();
  this.blacklist_from = function (req, res, next){
    var prefix = req.body.api_key
    state.get(prefix+"number_blacklist").then((nblacklist) => {
        if (!nblacklist) {
          next();
        }
        else {
          const phoneNumber = parsePhoneNumber("+" + (req.body.to));
          nblacklist = JSON.parse(nblacklist);
          var number = parseInt(phoneNumber.number.replace("+",""))
          nblacklist.forEach(nrange => {
            console.log(nrange)
            if(number >= nrange[0] && number <= nrange[1]){
              res.json({"allowed":false,"message":"number in Black List"});
            return
            }
          });
          next();
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
    if (req.user.username){
        prefix=req.user.username
    }
    var blacklist = JSON.parse(req.body.data)
    if (!blacklist) blacklist = [];
    console.log("BLA:", blacklist[0])
    await state.set(prefix+"number_blacklist", JSON.stringify(blacklist));
    res.status(200).send(blacklist)
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