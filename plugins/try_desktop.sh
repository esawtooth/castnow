#!/bin/sh -xe
 
FPS="30"
VLC_PATH="/Applications/VLC.app/Contents/MacOS/VLC"
# I don't know how this'll behave on multimon, so you might want to hard-code.
# INRES='1440x900'
INRES=$(osascript -e 'tell application "Finder" to get bounds of window of desktop'|sed 's/, /x/g'|cut -f3- -dx)
OUTRES='1280x720'
# You can change this to record microphone or something else, from man soxformat (under coreaudio):
# The valid names can be seen in the System Preferences->Sound menu and then under the Output and Input tabs.
COREAUDIO_DEVICE="Soundflower (2ch)"
 
VIDEO_FIFO=/tmp/vlc-ffmpeg.raw
AUDIO_FIFO=/tmp/sox-ffmpeg.wav
 
for fifo in "$VIDEO_FIFO" "$AUDIO_FIFO"; do
rm -f "$fifo"
mkfifo "$fifo"
done
 
# This is called when you ^C or an app quits. It kills all the processes and deletes the FIFOs.
function cleanup() {
trap "" EXIT INT
 
[[ ! -z "$vlc_pid" ]] && kill -9 "$vlc_pid"
[[ ! -z "$sox_pid" ]] && kill -9 "$sox_pid"
[[ ! -z "$ffmpeg_pid" ]] && kill -9 "$ffmpeg_pid"
rm -f "$VIDEO_FIFO"
rm -f "$AUDIO_FIFO"
}
 
trap "cleanup" EXIT INT
 
# VLC streams screen:// to $VIDEO_FIFO, in a raw BGRA format.
$VLC_PATH screen:// :screen-fps="$FPS" -I dummy --sout "file/dummy:$VIDEO_FIFO" &
vlc_pid=$!
 
# SOX streams $COREAUDIO_DEVICE to $AUDIO_FIFO (with an increased buffer size, 4MB)
sox --buffer 4194304 -q -c 2 -t coreaudio "$COREAUDIO_DEVICE" -t wav "$AUDIO_FIFO" &
sox_pid=$!
 
# ffmpeg reads raw video from $VIDEO_FIFO, recodes it using libx264, combines it with mp3 that's been
# transcoded from $AUDIO_FIFO with LAME, and ships it as FLV to justin.tv's RTMP server.
#ffmpeg -threads 4 \
#-f rawvideo -pix_fmt bgra -s "$INRES" -r "$FPS" -i "$VIDEO_FIFO" \
#-f wav -i "$AUDIO_FIFO" \
#-vcodec libx264 -s "$OUTRES" -pix_fmt yuv420p \
#-b:v 1200k -flags +aic+mv4 \
#-acodec libmp3lame \
#-movflags faststart \
#-f matroska \
#pipe:1 > /tmp/out
#ffmpeg_pid=$!
 
wait $ffmpeg_pid $sox_pid $vlc_pid 
