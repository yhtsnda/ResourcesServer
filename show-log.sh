log_path=`forever logs | grep -o '\(/.\{1,\}\.log\)'`
cat $log_path

