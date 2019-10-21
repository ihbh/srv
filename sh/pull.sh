# Makes a copy of the remote db.
#
#   $ bash sh/pull.sh
#   $ cd /tmp/ihbh/srv
#   $ ls
#
SRC=root@data.ihbh.org:/var/lib/ihbh/
DST=/tmp/ihbh/srv;
read -p "rsync $SRC into $DST?";
mkdir -p $DST;
rsync -az $SRC $DST --delete;
du -h -d 2 $DST;
