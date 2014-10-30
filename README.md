SSH Search Provider
=====================
A gnome-shell extension which searches the ssh-config file and provides the found SSH connections in your shell overview.

### Customisation

This fork has bespoke features for my personal use, including;
* a list view of results instead of a grid
* results limited to 20
* a dynamic result that allows the user to build their own SSH parameters in the overview
* a link to add the search term as a new SSH connection using a separate bespoke BASH script (hack)
* username and port (if not 22) displayed as a result
* better parsing of ssh-config
* removed parsing of known_hosts etc.
* icons set to Terminator (hack)

### License
Copyright (c) 2011 Bernd Schlapsi <brot@gmx.info>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
