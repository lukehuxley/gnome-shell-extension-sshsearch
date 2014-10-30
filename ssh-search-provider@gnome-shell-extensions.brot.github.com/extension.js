/* Ssh Search Provider for Gnome Shell
 *
 * Copyright (c) 2013 Bernd Schlapsi
 *
 * This programm is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This programm is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Search = imports.ui.search;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Util = imports.misc.util;
const IconGrid = imports.ui.iconGrid;

// Settings
const DEFAULT_TERMINAL_SCHEMA = 'org.gnome.desktop.default-applications.terminal';
const DEFAULT_TERMINAL_KEY = 'exec';
const DEFAULT_TERMINAL_ARGS_KEY = 'exec-arg';
const SSHSEARCH_TERMINAL_APP = 'gnome-terminal';

// sshSearchProvider holds the instance of the search provider
// implementation. If null, the extension is either uninitialized
// or has been disabled via disable().
var sshSearchProvider = null;

// try to find the default terminal app. fallback is gnome-terminal
function getDefaultTerminal() {
    try {
        if (Gio.Settings.list_schemas().indexOf(DEFAULT_TERMINAL_SCHEMA) == -1) {
            return {'exec': SSHSEARCH_TERMINAL_APP,
                    'args': ''
                   };
        }

        let terminal_setting = new Gio.Settings({ schema: DEFAULT_TERMINAL_SCHEMA });

        if (terminal_setting.get_string(DEFAULT_TERMINAL_KEY) != 'x-terminal-emulator') {

            return {'exec': terminal_setting.get_string(DEFAULT_TERMINAL_KEY),
                    'args': terminal_setting.get_string(DEFAULT_TERMINAL_ARGS_KEY)
                   };

        } else {

            return {'exec': SSHSEARCH_TERMINAL_APP,
                'args': ''
               };
        }
    } catch (err) {
        return {'exec': SSHSEARCH_TERMINAL_APP,
                'args': ''
               };
    }
}


var arrayUnique = function(a) {
    return a.reduce(function(p, c) {
        if (p.indexOf(c) < 0) p.push(c);
        return p;
    }, []);
};

//SshSearchProvider.prototype = {
const SshSearchProvider = new Lang.Class({
    Name: 'SshSearchProvider',
    Extends: Search.SearchProvider,

    activateResult: function(id) {

        hostArray = id.host.split('.');
        profile = hostArray[hostArray.length - 1];

        this._exec_ssh(id.user, id.host, id.port, profile);

        // start terminal with ssh command
        //Util.spawn(cmd);
    },

    _exec_ssh: function(user, host, port, profile) {

        let terminal_definition = getDefaultTerminal();
        let terminal_args = terminal_definition.args.split(' ');
        let cmd = [terminal_definition.exec];

        // add defined gsettings arguments, but remove --execute and -x
        for (var i=0; i<terminal_args.length; i++) {
            let arg = terminal_args[i];

            if (arg != '--execute' && arg != '-x' && arg != '--command' && arg != '-e') {
                cmd.push(terminal_args[i]);
            }
        }

        cmd.push('--profile=' + profile);

        // build command
        cmd.push('--command');

        if (user.length != 0) {
            target = user + '@' + host;
        } else {
            target = host;
        }

        cmd.push('ssh -t -p ' + port + ' ' + target);

        // start terminal with ssh command
        Util.spawn(cmd);

    },

    _add_ssh: function(user, host, port, profile) {

        cmd = Array('/usr/local/bin/ssh-config');
        cmd.push('add');
        cmd.push(user + '@' + host + ':' + port);

        // start terminal with ssh command
        Util.spawn(cmd);

    },

    _parse_ssh_string: function(ssh_string) {

        var atSplit = ssh_string.split('@');
        // If a user has been provided
        if (atSplit.length > 1) {
            var user = atSplit[0];
            var host = atSplit[1];
        // If a user has not been provided
        } else {
            var user = 'root';
            var host = ssh_string;
        }

        var colonSplit = host.split(':');
        // If host has a colon in it
        if (colonSplit.length > 1) {
            var port = colonSplit[1];
            host = colonSplit[0];
        // If host has no colon in it
        } else {
            var port = 22;
        }

        var dotSplit = host.split('.');
        // If host has a full stop in it
        if (dotSplit.length > 1) {
            var profile = dotSplit[dotSplit.length - 1];
        // If host has no full stop
        } else {
            var profile = 'Default';
        }

        return {
            'user': user,
            'host': host,
            'port': port,
            'profile': profile
        };

    },

    _ssh_array_to_str: function(ssh_array) {

        return ssh_array.user + '@' + ssh_array.host + ':' + ssh_array.port;

    },

    launchSearch: function(terms) {
        for (i=0; i < terms.length; i++) {

            ssh_result = this._parse_ssh_string(terms[i]);

            this._add_ssh(ssh_result.user, ssh_result.host, ssh_result.port, ssh_result.profile);
            this._exec_ssh(ssh_result.user, ssh_result.host, ssh_result.port, ssh_result.profile);
        }
    },

    _init: function() {
        // Since gnome-shell 3.6 the log output is in ~/.cache/gdm/session.log
        // Since gnome-shell 3.8 the log output is in /var/log/messages
        // Since gnome-shell 3.10 you get log output with "journalctl -f"
        //log('init ssh-search');

        let filename = '';
        let terminal_definition = getDefaultTerminal();

        this.title = "SSHSearch";
        this.id = "SSHSearch";
        this.searchSystem = null;
        this._configHosts = [];

        this.appInfo = {
            get_name: function() {
                return 'terminator';
            },
            get_icon: function() {
                return Gio.icon_new_for_string('/usr/share/icons/hicolor/scalable/apps/terminator.svg');
            },
            get_id: function() {
                return this.id;
            }
        };

        // init for ~/.ssh/config
        filename = GLib.build_filenamev([GLib.get_home_dir(), '/.ssh/', 'config']);
        let configFile = Gio.file_new_for_path(filename);
        this.configMonitor = configFile.monitor_file(Gio.FileMonitorFlags.NONE, null);
        this.configMonitor.connect('changed', Lang.bind(this, this._onConfigChanged));
        this._onConfigChanged(null, configFile, null, Gio.FileMonitorEvent.CREATED);

    },

    _onConfigChanged: function(filemonitor, file, other_file, event_type) {
        if (!file.query_exists (null)) {
            this._configHosts = [];
            return;
        }

        if (event_type == Gio.FileMonitorEvent.CREATED ||
            event_type == Gio.FileMonitorEvent.CHANGED ||
            event_type == Gio.FileMonitorEvent.CHANGES_DONE_HINT)
        {

            let content = file.load_contents(null);
            let filelines = String(content[1]).trim().split('\n');

            let host = '';
            let hosts = [];

            for (var i=0; i<filelines.length; i++) {

                let line = filelines[i].toLowerCase();

                // If line begins with "host "
                if (line.lastIndexOf('host ', 0) == 0) {

                    let hostname = line.slice('host '.length);

                    // If this is the first host to be added
                    if (host.length > 0) {
                        hosts.push(host);
                    }

                    host = hostname;

                // If line contains "user "
                } else if (line.match('user ')) {

                    index = line.indexOf('user ');
                    host = line.slice('user '.length + index) + '@' + host;

                // If line contains "port "
                } else if (line.match('port ')) {

                    index = line.indexOf('port ');
                    host = host + ':' + line.slice('port '.length + index);

                }
            }

            // Very last host in the file
            if (host.length > 0) {
                hosts.push(host);
            }

            this._configHosts = arrayUnique(hosts);

        }
    },

    createResultObject: function(result, terms) {
        return null;
    },

    getResultMetas: function(resultIds, callback) {
        let metas = resultIds.map(this.getResultMeta, this);
        callback(metas);
    },

    getResultMeta: function(resultId) {
        let ssh_name = resultId.host;
        let terminal_definition = getDefaultTerminal();

        if (resultId.port != 22) {
            ssh_name = ssh_name + ':' + resultId.port;
        }

        if (resultId.user.length != 0) {
            ssh_name = resultId.user + '@' + ssh_name;
        }

        return { 'id': resultId,
                 'name': ssh_name,
                 'createIcon': function(size) {
                        let xicon = new Gio.ThemedIcon({name: terminal_definition.exec});
                        return new St.Icon({icon_size: size,
                                            gicon: xicon});
                 }
               };
    },

    _checkHostnames: function(hostnames, terms) {
        let searchResults = [];
        for (var i=0; i<hostnames.length; i++) {
            for (var j=0; j<terms.length; j++) {
                try {

                    if (hostnames[i].match(terms[j]))
                        searchResults.push(this._parse_ssh_string(hostnames[i]));

                }
                catch(ex) {
                    continue;
                }
            }
        }
        return searchResults;
    },

    filterResults: function(providerResults, maxResults) {
        return providerResults;
    },

    _getResultSet: function(sessions, terms) {
        // check if a found host-name begins like the search-term
        let results = [];
        let res = terms.map(function (term) { return new RegExp(term, 'i'); });

        results = results.concat(this._checkHostnames(this._configHosts, terms));

        // Limit the search result to 20 items
        results.splice(10);

        for (i=0; i<terms.length; i++) {
            let new_ssh_item = this._parse_ssh_string(terms[i]);

            if (results.length == 1) {
                if (this._ssh_array_to_str(results[0]) != this._ssh_array_to_str(new_ssh_item))
                    results = results.concat(new_ssh_item);
            } else {
                results = results.concat(new_ssh_item);
            }

        }

        this.searchSystem.setResults(this, results);
    },

    getInitialResultSet: function(terms) {
        return this._getResultSet(this._sessions, terms);
    },

    getSubsearchResultSet: function(previousResults, terms) {
        return this._getResultSet(this._sessions, terms);
    },
});

function init() {
}

function enable() {
    if (!sshSearchProvider) {
        sshSearchProvider = new SshSearchProvider();
        Main.overview.addSearchProvider(sshSearchProvider);
    }
}

function disable() {
    if  (sshSearchProvider) {
        Main.overview.removeSearchProvider(sshSearchProvider);
        sshSearchProvider.configMonitor.cancel();
        sshSearchProvider.knownhostsMonitor.cancel();
        sshSearchProvider.sshknownhostsMonitor1.cancel();
        sshSearchProvider.sshknownhostsMonitor2.cancel();
        sshSearchProvider = null;
    }
}
