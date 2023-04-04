cd ../output/neighborhood

for ERA in `ls .`
do
  echo "zipping $ERA ..."
  cd $ERA
  zip a -tzip $ERA.zip .
  cd ..
  mv $ERA/$ERA.zip .
done
#zip a -tzip $1.zip $1