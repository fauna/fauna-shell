#! /bin/sh

if [ -x "bin/run" ]; then
  FAUNA_CMD="bin/run"
elif [ -x "../bin/run" ]; then
  FAUNA_CMD="../bin/run"
else
  echo "Can't find the fauna command (tried bin/run and ../bin/run)"
  exit 1
fi

echo "Using following to execute: $FAUNA_CMD"

cleanup_collection () {
  COLLECTION="$1"
  if [ -z "$COLLECTION" ]; then
    echo "missing collection arg"
    exit 1
  fi
  
  # TODO - skip if the collection doesn't exist
  $FAUNA_CMD eval --stdin --endpoint data-import-test << CMD
    Map(
      Paginate(Documents(Collection("$COLLECTION"))),
      Lambda("X",Delete(Var("X")))
    )
CMD
}

cleanup_collection "bool_type"
$FAUNA_CMD import --endpoint data-import-test --type=favorite::bool --path=oss-926/bool_type.csv
if [ $? != 0 ];then
  echo "bool_type.csv didn't import with success"
  exit 1
fi

cleanup_collection "date_type"
$FAUNA_CMD import --endpoint data-import-test --type=birthday::date --path=oss-926/date_type.csv
if [ $? != 0 ];then
  echo "date_type.csv didn't import with success"
  exit 1
fi

cleanup_collection "bad_date_type"
$FAUNA_CMD import --endpoint data-import-test --type=birthday::date --path=oss-926/bad_date_type.csv
if [ $? == 0 ];then
  echo "bad_date_type.csv didn't import with success"
  exit 1
fi


echo "--------------------------------------------------"
echo "ALL SCRAPPY TESTS PASSED!!"
