# How to use this with your own setup!!
1. What's going to be your sub URL? For our example this will be `myfriendgroup`
2. Install ultrastar on your computer with the right songs
   1. [Download this custom version of Ultrastar Deluxe]([foobar.com](https://mega.nz/folder/______________)), and extract it where you want on your Windows computer
   2. Download all necessary songs from [this cloud directory](https://mega.nz/folder/______________). Don't download the folders starting with `_`. Put them in your `songs/` directory in the ultrastar folder.
   3. Edit the `config.ini` file in your ultrastar folder like this:
      - Under `[Directories]` edit the list so that it looks like `SongDir1=songs/w-dance SongDir2=songs/w-modern` etc. covering all folders existing in your songs directory
      - Under `[Jukebox]` edit `ServerUrl=https://karaokeq.q42.workers.dev/jiri` to be `ServerUrl=https://karaokeq.q42.workers.dev/myfriendgroup`
3. Creating the `myfriendgroup` environment
   1. Do a post request to `https://karaokeq.q42.workers.dev/jiri/create`
4. Regular usage
   - Boot up Ultrastar (the `ultrastardx.exe` file in the ultrastar folder, feel free to create a shortcut to this file) -> Jukebox -> Press Enter ('All songs' is fine)
   - Ultrastar will be syncing its queue with the server for your custom environment!
   - Go to `https://karaoke.jirinrin.com/myfriendgroup` for the regular interface to request songs for your stuff etc
   - Go to `https://karaoke.jirinrin.com/myfriendgroup/admin` for the 'admin dashboard'. Click `Authorize` and input the admin token you used for creation. Your browser now has admin priviledges!
     - Now you can choose a different background on this same page, and on the regular queue page you have extra options by clicking on the word Queue or a song. You can also vote infinitely and don't have a cooldown for requesting songs.
5. Updating the song list to the latest version
   - Currently there's no good system to keep track of your own songlist, so you'll want to regularly update the songs directory in your ultrastar. Do this by simply downloading the entire thing again. There is a more efficient way by dragging the folder to your megasync downloads but that's a pain to explain lmao

Note: for now you'll just have to use my given song list, but in the future you should be able to sync your own song list to this so you don't have to use include e.g. all my weeb songs, and your local ultrastar also won't break when I update the server with a new songlist.