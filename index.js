// Importing Packages
require("http").createServer((req, res) => res.end("Bot is OP LOVE U")).listen(process.env.PORT || 8080)
const Discord = require("discord.js")
const SQLite = require("better-sqlite3")
const sql = new SQLite('./mainDB.sqlite')
const { join } = require("path")
const { readdirSync } = require("fs");
const client = new Discord.Client()
const { Schema } = require('mongoose')
const mongoose = require('mongoose')
const ms = require('ms')
client.commands = new Discord.Collection();
const cooldowns = new Discord.Collection();
const talkedRecently = new Map();
const fs = require('fs')
// Token, Prefix, and Owner ID
const config = require("./config.json")
const xpList = require('./moreXP.json')
let moreXPChannelss = xpList.moreXPChannels || [];
// Events
client.login(config.token) 

client.on("ready", () => {
  // Check if the table "points" exists.
    const levelTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'levels';").get();
    if (!levelTable['count(*)']) {
      sql.prepare("CREATE TABLE levels (id TEXT PRIMARY KEY, user TEXT, guild TEXT, xp INTEGER, level INTEGER, totalXP INTEGER);").run();
    }

    client.getLevel = sql.prepare("SELECT * FROM levels WHERE user = ? AND guild = ?");
    client.setLevel = sql.prepare("INSERT OR REPLACE INTO levels (id, user, guild, xp, level, totalXP) VALUES (@id, @user, @guild, @xp, @level, @totalXP);");
  // Role table for levels
    const roleTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'roles';").get();
    if (!roleTable['count(*)']) {
      sql.prepare("CREATE TABLE roles (guildID TEXT, roleID TEXT, level INTEGER);").run();
    }

  // Prefix table
    const prefixTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'prefix';").get();
    if (!prefixTable['count(*)']) {
      sql.prepare("CREATE TABLE prefix (serverprefix TEXT, guild TEXT PRIMARY KEY);").run();
    }

  // Blacklist table
    const blacklistTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'blacklistTable';").get();
    if (!blacklistTable['count(*)']) {
      sql.prepare("CREATE TABLE blacklistTable (guild TEXT, typeId TEXT, type TEXT, id TEXT PRIMARY KEY);").run();
    }

  // Settings table
    const settingsTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'settings';").get();
    if (!settingsTable['count(*)']) {
    sql.prepare("CREATE TABLE settings (guild TEXT PRIMARY KEY, levelUpMessage TEXT, customXP INTEGER, customCooldown INTEGER);").run();
    }
    
    const channelTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'channel';").get();
    if (!channelTable['count(*)']) {
    sql.prepare("CREATE TABLE channel (guild TEXT PRIMARY KEY, channel TEXT);").run();
    }


  // RankCard table (WORK IN PROGRESS, STILL IN THE WORKS)
    // const rankCardTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'rankCardTable';").get();
    // if (!rankCardTable['count(*)']) {
    // sql.prepare("CREATE TABLE rankCardTable (id TEXT PRIMARY KEY, user TEXT, guild TEXT, image BLOB, fontColor TEXT, barColor TEXT, overlay TEXT);").run();
    // }

    console.log(`Logged in as ${client.user.username}`)
});

// Command Handler
const commandFiles = readdirSync(join(__dirname, "commands")).filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
  const command = require(join(__dirname, "commands", `${file}`));
  client.commands.set(command.name, command);
}

// Message Events
client.on("message", (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const currentPrefix = sql.prepare("SELECT * FROM prefix WHERE guild = ?").get(message.guild.id);
    const Prefix = config.prefix;
    var getPrefix;
    if(!currentPrefix) {
      sql.prepare("INSERT OR REPLACE INTO prefix (serverprefix, guild) VALUES (?,?);").run(Prefix, message.guild.id)
      getPrefix = Prefix.toString();
    } else {
      getPrefix = currentPrefix.serverprefix.toString();
    }

  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefixRegex = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(getPrefix)})\\s*`);
  if (!prefixRegex.test(message.content)) return;

  const [, matchedPrefix] = message.content.match(prefixRegex);

  const args = message.content.slice(matchedPrefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command =
    client.commands.get(commandName) ||
    client.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(commandName));

  if (!command) return;

  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Discord.Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 1) * 1000;

  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return message.reply(
        `Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`
      );
    }
  }

  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  try {
    command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply("There was an error executing that command.").catch(console.error);
  }
});

mongoose.connect("mongodb+srv://data4:Lhbeu3U9Dj8e2QS3@432423teisr324.kcxwh.mongodb.net/?retryWrites=true&w=majority", {
  useFindAndModify: true,
  useUnifiedTopology: true,
  useNewUrlParser: true,
})
// XP Messages 
client.on("message", message => {
  if (message.author.bot) return;
  if (!message.guild) return;
  let blacklist = sql.prepare(`SELECT id FROM blacklistTable WHERE id = ?`);
  if(blacklist.get(`${message.guild.id}-${message.author.id}`) || blacklist.get(`${message.guild.id}-${message.channel.id}`)) return;

        // get level and set level
        const level = client.getLevel.get(message.author.id, message.guild.id) 
        if(!level) {
          let insertLevel = sql.prepare("INSERT OR REPLACE INTO levels (id, user, guild, xp, level, totalXP) VALUES (?,?,?,?,?,?);");
          insertLevel.run(`${message.author.id}-${message.guild.id}`, message.author.id, message.guild.id, 0, 0, 0)
          return;
        }

        let customSettings = sql.prepare("SELECT * FROM settings WHERE guild = ?").get(message.guild.id);
        let channelLevel = sql.prepare("SELECT * FROM channel WHERE guild = ?").get(message.guild.id);

        const lvl = level.level;

        let getXpfromDB;
        let getCooldownfromDB;

        if(!customSettings)
        {
          getXpfromDB = 16; // Default
          getCooldownfromDB = 1000;
        } else {
          getXpfromDB = customSettings.customXP;
          getCooldownfromDB = customSettings.customCooldown;
        }

      // xp system
        const generatedXp = Math.floor(Math.random() * getXpfromDB);
        const generatedXp2 = Math.floor(Math.random() * config.moreXPChannelsXP);
        const nextXP = level.level * 2 * 250 + 250
        // message content or characters length has to be more than 4 characters also cooldown
      if(talkedRecently.get(message.author.id)) {
        return;
      } else { // cooldown is 10 seconds
        if (moreXPChannelss.some(g => g.includes(message.channel.id))) {
          level.xp += generatedXp2;
          level.totalXP += generatedXp2;
        }
        else {
        level.xp += generatedXp;
            level.totalXP += generatedXp;
        }

      // level up!
        if(level.xp >= nextXP) {
                level.xp = 0;
                level.level += 1;

        let levelUpMsg;
        let embed = new Discord.MessageEmbed()
              .setAuthor(message.author.tag, message.author.displayAvatarURL({ dynamic: true }))
              .setColor("RANDOM")
              .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
              .setTimestamp();

              if(!customSettings)
              {
                embed.setDescription(`**Congratulations** ${message.author}! You have now leveled up to **level ${level.level}**`);
                levelUpMsg = `**Congratulations** ${message.author}! You have now leveled up to **level ${level.level}**`;
              } else {
                function antonymsLevelUp(string) {
                  return string
                    .replace(/{member}/i, `${message.member}`)
                    .replace(/{xp}/i, `${level.xp}`)
                    .replace(/{level}/i, `${level.level}`)
                }
                embed.setDescription(antonymsLevelUp(customSettings.levelUpMessage.toString()));
                levelUpMsg = antonymsLevelUp(customSettings.levelUpMessage.toString());
              }
        // using try catch if bot have perms to send EMBED_LINKS      
        try {
          if(!channelLevel || channelLevel.channel == "Default")
          {
            message.channel.send(embed);
          } else {
            let channel = message.guild.channels.cache.get(channelLevel.channel)
            const permissionFlags = channel.permissionsFor(message.guild.me);
            if(!permissionFlags.has("SEND_MESSAGES") || !permissionFlags.has("VIEW_CHANNEL")) return;
            channel.send(embed);
          }
        } catch (err) {
          if(!channelLevel || channelLevel.channel == "Default")
          {
            message.channel.send(levelUpMsg);
          } else {
            let channel = message.guild.channels.cache.get(channelLevel.channel)
            const permissionFlags = channel.permissionsFor(message.guild.me);
            if(!permissionFlags.has("SEND_MESSAGES") || !permissionFlags.has("VIEW_CHANNEL")) return;
            channel.send(levelUpMsg);
          }
        }
      };
      client.setLevel.run(level);
      // add cooldown to user
    talkedRecently.set(message.author.id, Date.now() + getCooldownfromDB);
    setTimeout(() => talkedRecently.delete(message.author.id, Date.now() + getCooldownfromDB))    
      }
            // level up, time to add level roles
            const member = message.member;
            let Roles = sql.prepare("SELECT * FROM roles WHERE guildID = ? AND level = ?")
            
            let roles = Roles.get(message.guild.id, lvl)
            if(!roles) return;
            if(lvl >= roles.level) {
            if(roles) {
            if (member.roles.cache.get(roles.roleID)) {
              return;
            }
               if(!message.guild.me.hasPermission("MANAGE_ROLES")) {
                 return
               }
             member.roles.add(roles.roleID);
            }}
})
const schemas = {
  timer: mongoose.model(
      "djs-voice-timers",
       new mongoose.Schema({
          User: String,
          Start: Number,
          Guild: String,
      })
  ),
  user: mongoose.model(
      "djs-voice-users",
      new mongoose.Schema({
          User: String,
          Time: Number,
          Guild: String,
      })
  ),
};

client.on("voiceStateUpdate",function(oldState, newState){
  if (newState.member.user.bot) return;
        const userID = newState.member.id;
        const guildID = newState.guild.id;

        if (
            newState.channel)
       {
                console.log(
                    `${newState.member.user.tag} has joined a voice channel`
                );

            new schemas.timer({
                User: userID,
                Start: Date.now(),
                Guild: guildID,
            }).save();
        }

        if (oldState.channel?.id && !newState.channel?.id) {
                console.log(
                    `${newState.member.user.tag} has left a voice channel`
                );

            schemas.timer.findOne(
                { User: userID, Guild: guildID },
                async (err, timerData) => {
                    if (!timerData) return;

                    schemas.user.findOne(
                        { User: userID, Guild: guildID },
                        async (err, userData) => {
                            const Time = Date.now() - timerData.Start;
                            timerData.delete();
                            let eta = Time / 1000 / 60
                              let blacklist = sql.prepare(`SELECT id FROM blacklistTable WHERE id = ?`);
                              if(blacklist.get(`${newState.guild.id}-${newState.member.id}`) || blacklist.get(`${newState.guild.id}-${oldState.channelID}`)) return;
                            
                                    // get level and set level
                                    const level = client.getLevel.get(newState.member.id, newState.guild.id) 
                                    if(!level) {
                                      let insertLevel = sql.prepare("INSERT OR REPLACE INTO levels (id, user, guild, xp, level, totalXP) VALUES (?,?,?,?,?,?);");
                                      insertLevel.run(`${newState.member.id}-${newState.guild.id}`, newState.member.id, newState.guild.id, 0, 0, 0)
                                      return;
                                    }
                            
                                    let customSettings = sql.prepare("SELECT * FROM settings WHERE guild = ?").get(newState.guild.id);
                                    let channelLevel = sql.prepare("SELECT * FROM channel WHERE guild = ?").get(newState.guild.id);
                            
                                    const lvl = level.level;
                            
                                    let getXpfromDB;
                                    let getCooldownfromDB;
                            
                                    if(!customSettings)
                                    {
                                      getXpfromDB = Math.round(xpmain); // Default
                                      getCooldownfromDB = 1000;
                                    } else {
                                      getXpfromDB = customSettings.customXP;
                                      getCooldownfromDB = customSettings.customCooldown;
                                    }
                            
                                  // xp system
                                  const generatedXp = Math.floor(Math.random() * getXpfromDB);
                                  const generatedXp2 = Math.floor(Math.random() * config.moreXPChannelsXP);
                                  const nextXP = level.level * 2 * 250 + 250
                                  // message content or characters length has to be more than 4 characters also cooldown
                                  if (moreXPChannelss.some(g => g.includes(oldState.channel?.id))) {
                                    level.xp += Math.round(generatedXp2 * eta);
                                    level.totalXP += Math.round(generatedXp2 * eta);
                                    client.setLevel.run(level);
                                  }
                                  else {
                                  level.xp += Math.round(generatedXp * eta);
                                      level.totalXP += Math.round(generatedXp * eta);
                                      client.setLevel.run(level);
                                  }    
                                
                                // level up!
                                  if(level.xp >= nextXP) {
                                          level.xp = 0;
                                          level.level += 1;
                          
                                  let levelUpMsg;
                                  let embed = new Discord.MessageEmbed()
                                        .setAuthor(message.author.tag, message.author.displayAvatarURL({ dynamic: true }))
                                        .setColor("RANDOM")
                                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                                        .setTimestamp();
                          
                                        if(!customSettings)
                                        {
                                          embed.setDescription(`**Congratulations** ${message.author}! You have now leveled up to **level ${level.level}**`);
                                          levelUpMsg = `**Congratulations** ${message.author}! You have now leveled up to **level ${level.level}**`;
                                        } else {
                                          function antonymsLevelUp(string) {
                                            return string
                                              .replace(/{member}/i, `${message.member}`)
                                              .replace(/{xp}/i, `${level.xp}`)
                                              .replace(/{level}/i, `${level.level}`)
                                          }
                                          embed.setDescription(antonymsLevelUp(customSettings.levelUpMessage.toString()));
                                          levelUpMsg = antonymsLevelUp(customSettings.levelUpMessage.toString());
                                        }
                                  // using try catch if bot have perms to send EMBED_LINKS      
                                  try {
                                    if(!channelLevel || channelLevel.channel == "Default")
                                    {
                                      message.channel.send(embed);
                                    } else {
                                      let channel = message.guild.channels.cache.get(channelLevel.channel)
                                      const permissionFlags = channel.permissionsFor(message.guild.me);
                                      if(!permissionFlags.has("SEND_MESSAGES") || !permissionFlags.has("VIEW_CHANNEL")) return;
                                      channel.send(embed);
                                    }
                                  } catch (err) {
                                    if(!channelLevel || channelLevel.channel == "Default")
                                    {
                                      message.channel.send(levelUpMsg);
                                    } else {
                                      let channel = message.guild.channels.cache.get(channelLevel.channel)
                                      const permissionFlags = channel.permissionsFor(message.guild.me);
                                      if(!permissionFlags.has("SEND_MESSAGES") || !permissionFlags.has("VIEW_CHANNEL")) return;
                                      channel.send(levelUpMsg);
                                    }
                                  }
                                
                                      // level up, time to add level roles
                                      const member = message.member;
                                      let Roles = sql.prepare("SELECT * FROM roles WHERE guildID = ? AND level = ?")
                                      
                                      let roles = Roles.get(message.guild.id, lvl)
                                      if(!roles) return;
                                      if(lvl >= roles.level) {
                                      if(roles) {
                                      if (member.roles.cache.get(roles.roleID)) {
                                        return;
                                      }
                                         if(!message.guild.me.hasPermission("MANAGE_ROLES")) {
                                           return
                                         }

                                       member.roles.add(roles.roleID);
                                        }
                                      }
                                    }
                            if (!userData) {
                                new schemas.user({
                                    User: userID,
                                    Time,
                                    Guild: guildID,
                                }).save();
                            } else {
                                userData.Time += Time;
                                userData.save();
                            }
                        }
                    );
                }
            );
        }
      })


client.on("message", async message => {
        if (message.author.bot || !message.guild || !message.content.toLowerCase().startsWith(config.prefix)) return;
        let args = message.content.split(' ').slice(1);
        let command = message.content.split(' ')[0].slice(config.prefix.length);
        let embed = new Discord.MessageEmbed().setColor("#000000").setAuthor(message.member.displayName, message.author.avatarURL({ dynamic: true, })).setFooter(config.ignoreCommandFooter).setTimestamp();
        let target = args[0]
      
        if(command === "extra-channel") {
      
          embed.setDescription(`You must specify a channel ID to add/remove from the blacklist!`);
          embed.addField("Extra XP Channels", moreXPChannelss.length > 0 ? moreXPChannelss.map(g => g).join('\n') : "Doesn't Exist Anything!")
          if (!target) return message.channel.send(embed)
          if (moreXPChannelss.some(g => g.includes(target))) {
            moreXPChannelss = moreXPChannelss.filter(g => !g.includes(target));
            xpList.moreXPChannels = moreXPChannelss;
            fs.writeFile("moreXP.json", JSON.stringify(xpList), (err) => {
              if (err) console.log(err);
            });
            embed.setDescription(`${target}, removed from blacklist by ${message.author}!`);
            message.channel.send(embed)
          } else {
            list = xpList
            list.moreXPChannels.push(target);
            fs.writeFile("moreXP.json", JSON.stringify(list), (err) => {
              if (err) console.log(err);
            });
            embed.setDescription(`${target}, added to the blacklist by ${message.author}!`);
            message.channel.send(embed)
          };
        };
      });