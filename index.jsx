const { getModule, React, constants, channels } = require('powercord/webpack');
const { sleep, injectContextMenu } = require('powercord/util');
const { uninject } = require('powercord/injector');
const { Plugin } = require('powercord/entities');
const { Menu } = require('powercord/components');

const { getVoiceStatesForChannel } = getModule(['getVoiceStatesForChannel'], false);
const { patch } = getModule(m => typeof m == 'object' && m.patch, false);
const Permissions = getModule(['getChannelPermissions'], false);
const { getChannel } = getModule(['hasChannel'], false);
const { getGuild } = getModule(['getGuild'], false);

module.exports = class VoiceChatMoveAll extends Plugin {
   startPlugin() {
      const _this = this;

      injectContextMenu('vc-move-all', 'ChannelListVoiceChannelContextMenu', function ([{ channel }], res) {
         res = res.type.apply(this, [res.props]);
         if (!channel?.guild_id || !_this.canMoveAll(channel)) return res;
         const voice = _this.getVoiceChannel();
         if (!voice) return res;

         console.log(res);

         res.props.children.push(
            <Menu.MenuGroup>
               <Menu.MenuItem
                  id='move-all-vc'
                  label='Move All'
                  action={async () => {
                     for (const member of voice.members) {
                        await patch({
                           url: constants.Endpoints.GUILD_MEMBER(channel.guild_id, member),
                           body: {
                              channel_id: channel.id
                           }
                        }).catch(async (e) => {
                           await sleep(e.body.retry_after * 1000);
                           voice.members.unshift(member);
                        });
                     }
                  }}
               />
            </Menu.MenuGroup>
         );

         return res;
      });
   }

   pluginWillUnload() {
      uninject('vc-move-all');
   }

   getVoiceUserIds(channel) {
      if (!channel) return null;
      return Object.keys(getVoiceStatesForChannel(channel));
   }

   canMoveAll(channel) {
      const instance = this.getVoiceChannel();

      if (instance?.channel.id === channel.id) return;
      if (instance?.channel.guild_id !== channel.guild_id) return;

      const isAdmin = Permissions.can(constants.Permissions.ADMINISTRATOR, getGuild(channel.guild_id));
      const isWithinLimit = channel.userLimit == 0 || channel.userLimit - instance.count >= 0;

      if (isAdmin || (this.canJoinAndMove(channel) && isWithinLimit)) {
         return true;
      }

      return false;
   }

   canJoinAndMove(channel) {
      return (
         Permissions.can(constants.Permissions.CONNECT, channel) &&
         Permissions.can(constants.Permissions.MOVE_MEMBERS, channel)
      );
   }

   getVoiceChannel() {
      const channel = getChannel(channels.getVoiceChannelId());
      const members = this.getVoiceUserIds(channel?.id);
      if (!channel || !members) return null;

      return {
         channel,
         members,
         count: members.length
      };
   }
};
