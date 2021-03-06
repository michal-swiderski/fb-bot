const fs = require('fs-extra');
const {join} = require('path');
const parseMessage = require('./utils/message-parser.js');
const request = require('request-promise');
const {downloadFile} = require('./utils/utils.js')
const uuid = require('uuid/v1');

module.exports = async function messageHandler(message){
    let prefix = this.db.getThreadConfig(message.threadID).prefix;
    let {success, args, cmd} = parseMessage(message.body, prefix);
    
    if(!success) return;

    cmd = cmd.toLowerCase();
    let command = this.commands.find((command) => command.props.triggers.includes(cmd));
    //check admin permissions
    if(command.props.admin){
        const {adminIDs} = await this.db.getThreadInfo(message.threadID);
        if(adminIDs.length && !adminIDs.map(item => item.id).includes(message.senderID)){
            this.client.sendMessage('You have to be an admin to use this command', message.threadID);
            this.client.setMessageReaction(':angry:', message.messageID);
            return;
        }
    }
    if(command !== undefined){
        //check and set cooldown
        let userCooldowns = this.cooldowns.get(message.senderID);
        if(!userCooldowns){
            this.cooldowns.set(message.senderID, []);
            userCooldowns = this.cooldowns.get(message.senderID);
        }
        let cooldown = userCooldowns.find(c => c.triggers.includes(cmd));
        if(cooldown){
            if(cooldown.until > Date.now())
            {   
                let waitTime = cooldown.until - Date.now();
                this.client.sendMessage(`You have to wait ${waitTime/1000}s to use this command`, message.threadID);
                return;
            }
            else{
                cooldown.until = Date.now() + command.props.cooldown;
            }
        }
        else
            userCooldowns.push({triggers : command.props.triggers, until : Date.now() + command.props.cooldown});


        let {text, attachment} = await command.execute(args, message, this);
        if(text !== undefined)
            this.client.sendMessage(text, message.threadID);

        if(attachment !== undefined){
            if(attachment.startsWith('http')){
                const filename = attachment.split('?').shift().split('/').pop();
                fs.ensureDir(join(__dirname, 'tmp'));
                const path = join(__dirname, 'tmp', filename);
                await downloadFile(attachment, path);
                this.client.sendMessage({
                    attachment : fs.createReadStream(path),
                }, message.threadID, ()=>{
                    fs.unlink(path)
                });
            }
            else{
                this.client.sendMessage({
                    attachment : fs.createReadStream(join(__dirname, attachment))
                }, message.threadID)
            }
        }
    }
    else{
        this.client.sendMessage(message.threadID, 'I dont know what you want me to do faggot');
    }
}
