![alt](https://challenges.s3.amazonaws.com/ford-series/taiwan/tunnel-bkgd.jpg)
Hsuehshan Tunnel Starter Kit
----------------------------

A test ground for playing with the Hsuehshan Tunnel information.

This is by no means a complete project, just something I'm throwing together in my free time in order to better understand the data provided by the Taiwanese Ministry of Transportation and Communications.

What's Included
---------------
So far I've just scraped all the device and vehicle data out of the CSV and XML files, and dumped it into a SQLite database. (Yip, it's a not so lite SQLite instance). Now the data is more easily queriable, I want to start creating some views and interactions to understand the information available.

![alt](https://raw.githubusercontent.com/patcullen/hsuehshan/master/screenshots/map_preview.png)

![alt](https://raw.githubusercontent.com/patcullen/hsuehshan/master/screenshots/map_line.png)

How To Install
--------------
Step one would be cloning this repo. Now you need the data provided by the MOTC. The easier and faster way to get some of the data to play with is to simply unrar the included hsueshan.sql.rar in the root of this project folder.

Or, if you prefer to modify the import and work from the original data,.. You may download it from [this link](http://hsuehshantunnel.devpost.com/details/resources) and import it using the action I've left in the project (localhost:3000/hsueh/setup). I had my data and project folder setup in this arrangement as of this writing. The three important points to note. The data folder name is hsuehshan_data, the device CSV file name, and then the traffic XML data is unzipped into the traffic/ subfolder.

![alt](https://raw.githubusercontent.com/patcullen/hsuehshan/master/screenshots/folder_layout.png)

Contributing
------------

If something is unclear or confusing, please let me know.
Pull requests are always welcome.

License
-------

The MIT License (MIT)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
