const { getModule, getAllModules, React, constants } = require('powercord/webpack');
const ChannelContextMenu = getAllModules((m) => m.default && m.default.displayName == 'ChannelListVoiceChannelContextMenu', false)[0];
const DiscordPermissions = getModule(['Permissions'], false).Permissions;
const { getVoiceChannelId } = getModule(['getVoiceChannelId'], false);
const { getVoiceStates } = getModule(['getVoiceStates'], false);
const { inject, uninject } = require('powercord/injector');
const { patch } = getModule(['APIError', 'patch'], false);
const Menu = getModule(['MenuGroup', 'MenuItem'], false);
const Permissions = getModule(['getHighestRole'], false);
const { getChannel } = getModule(['getChannel'], false);
const { Plugin } = require('powercord/entities');
const { sleep } = require('powercord/util');

module.exports = class VoiceChatMoveAll extends Plugin {
   async startPlugin() {
      inject('vc-move-all', ChannelContextMenu, 'default', (args, res) => {
         let channel = args[0].channel;
         if (!channel.guild_id || !this.canMoveAll(channel)) return res;
         let currentChannel = this.getVoiceChannel();
         if (currentChannel.members.length < 2) return res;

         let item = React.createElement(Menu.MenuItem, {
            action: async () => {
               for (const member of currentChannel.members) {
                  await patch({
                     url: constants.Endpoints.GUILD_MEMBER(channel.guild_id, member),
                     body: {
                        channel_id: channel.id
                     }
                  }).catch(async (e) => {
                     await sleep(e.body.retry_after * 1000);
                     currentChannel.members.unshift(member);
                  });
                  await sleep(350);
               }
            },
            id: 'move-all-vc',
            label: 'Move All'
         });

         let element = React.createElement(Menu.MenuGroup, null, item);
         res.props.children.push(element);
         return res;
      });
      ChannelContextMenu.default.displayName = 'ChannelListVoiceChannelContextMenu';
   }

   pluginWillUnload() {
      uninject('vc-move-all');
   }

   getVoiceUserIds(guild, channel) {
      return Object.values(getVoiceStates(guild)).filter((c) => c.channelId == channel).map((a) => a.userId);
   }

   canMoveAll(channel) {
      let currentChannel = this.getVoiceChannel();
      let channelCount = this.getVoiceCount(channel);
      if (
         this.canJoinAndMove(channel) && (Permissions.can(DiscordPermissions.CONNECT, channel) ||
            channel.userLimit == 0 || channel.userLimit - currentChannel.count > channelCount + currentChannel.count
         )
      ) return true;
      return false;
   }

   canJoinAndMove(channel) {
      return Permissions.can(DiscordPermissions.CONNECT, channel) && Permissions.can(DiscordPermissions.MOVE_MEMBERS, channel);
   }

   getVoiceCount(guild, channel) {
      return Object.values(getVoiceStates(guild)).filter((c) => c.channelId == channel).length;
   }

   getVoiceChannel() {
      let channel = getChannel(getVoiceChannelId());
      return { channel: channel, members: this.getVoiceUserIds(channel.guild_id, channel.id) };
   }
};
