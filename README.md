# sarna-img-generator
A collection of scripts that generate planetary systems images used on sarna.net.

## Setup

Please contact me (gruese) if you get stuck on any of these steps:

- Download a current version of nodejs, the javascript runtime, from here: https://nodejs.org/en/download/

  The recommendation for most Windows users is to download the LTS (stable) version 64-bit installer.

  Run the installer, you can skip the option python + chocolatey install.

- Download a zip archive with this script from here: https://github.com/aquachris/sarna-img-generator/releases/tag/v1.62

  Unzip the archive into any directory on your machine, e.g. "D:\scripts\sarna-img-generator".

- Open a shell / console on your machine. If you're running Windows, open the start menu and type ``cmd``, which will open the Windows command shell.

  In your shell, navigate to the script directory, e.g. by switching to the D drive by typing ``D:``, then changing to your directory with the ``cd`` command, e.g. ``cd scripts/sarna-img-generator``

- Once you're inside the script directory, execute the following command: ``npm i``. This installs all of the libraries that the  script depends upon. Setup is now complete.

## Data source

It's important to note that this script does **NOT** directly pull its data from the SUCKit Google sheet, but rather from a local XLSX copy of that master spreadsheet.

The advantage of this is that you can play around with your local version of the data without affecting the main data collection. The downside is, of course, the necessity for a manual download if you want to pull a new version of the SUCKit.

This repository comes "batteries included", i.e. it includes a recent version of the SUCKit in XLSX format. This file is located in  
``<script directory>/data/Sarna Unified Cartography Kit (Official).xlsx``  
Note that this is a fixed location that, as of now, cannot be changed.

If you want to use a new version of the SUCKit, do the following: 
- Open the SUCKit in your browser (https://docs.google.com/spreadsheets/d/1uO6aZ20rfEcAZJ-nDRhCnaNUiCPemuoOOd67Zqi1MVM)
- In the top menu, click on ``File`` > ``Download`` > ``.xlsx``
- Locate the downloaded file, rename it to ``Sarna Unified Cartography Kit (Official).xlsx`` (if necessary) and move it to the ``<script directory>/data/`` folder, replacing the existing file.

## Generating maps

The script can generate three different types of map images: Known universe, Inner Sphere or system neighborhood maps.

### Known universe maps

These maps depict the entire known Battletech universe. The mapped area (in a cartesian 2D coordinate system where one unit is one light year) ranges from ``(-2000,-2000)`` to ``(2000,2000)``, and thus displays a total area of 4000 by 4000 LY.

You can generate a map of the known universe by navigating to the script directory in your command shell (as described in the setup section) and executing the following command:

    npm start generate universe <year>

The ``<year>`` parameter represents the in-universe year and is optional. If left empty, the script will generate universe maps for all eras present in the data source.

The resulting map images will be saved to  
``<script directory>/output/universe``

> Usage examples:  
>
> ``npm start generate universe 3025``  
> -> generates the universe map for 3025
>
> ``npm start generate universe``  
> -> generates universe maps for all eras

### Inner Sphere maps

These maps depict the Inner Sphere. The mapped area (in a cartesian 2D coordinate system where one unit is one light year) ranges from ``(-650,-570)`` to ``(800,630)`` and thus displays a total area of 1450 by 1200 LY.

You can generate a map of the Inner Sphere by navigating to the script directory in your command shell (as described in the setup section) and executing the following command:

    npm start generate innersphere <year>

The ``<year>`` parameter represents the in-universe year and is optional. If left empty, the script will generate Inner Sphere maps for all eras present in the data source.

The resulting map images will be saved to  
``<script directory>/output/innersphere``

> Usage examples:  
>
> ``npm start generate innersphere 3025``  
> -> generates the Inner Sphere map for 3025
>
> ``npm start generate innersphere``  
> -> generates Inner Sphere maps for all eras

### Sarna interstellar neighborhood maps

These maps depict the immediate interstellar neighborhood of a given focused system. Given the focused system's coordinates of ``(fx,fy)``, the mapped area ranges from ``(fx - 70, fy - 65)`` to ``(fx + 70, fy + 95)`` and thus displays a total area of 140 by 160 LY, with an additional "mini-map" at the image's bottom right to show the focused system's larger context.

You can generate a neighborhood map by navigating to the script directory in your command shell (as described in the setup section) and executing the following command:

    npm start generate neighborhood <year> <systemName>

The ``<year>`` parameter represents the in-universe year and is optional. If left empty, the script will generate neighborhood maps for all eras present in the data source.

The ``<systemName>`` is an optional search string to generate neighborhood images only for certain systems. Only if the system's name contains the parameter, the map will be generated.  
Leaving the ``<systemName>`` parameter empty will generate neighborhood images for *all* systems in the data source. Note that this will result in the script running for a long time.

> **TIP**: Hit CTRL+C to stop the script anytime.

The resulting map images will be saved to ``<script directory>/output/neighborhood``

> Usage examples:  
>
> ``npm start generate neighborhood 3025 tharkad``  
> -> generates the neighborhood map for the Tharkad system in 3025
>
> ``npm start generate neighborhood 3025``  
> -> generates neighborhood maps for all systems in 3025
> 
> ``npm start generate neighborhood``  
> -> generates all neighborhood maps

