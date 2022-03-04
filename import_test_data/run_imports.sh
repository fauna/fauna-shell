#! /bin/sh

if [ -x "bin/run" ]; then
  FAUNA_CMD="bin/run"
elif [ -x "../bin/run" ]; then
  FAUNA_CMD="../bin/run"
else
  echo "Can't find the fauna command (tried bin/run and ../bin/run)"
  exit 1
fi

# Uncomment to default to the current impl
#FAUNA_CMD="fauna"

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

run_type_tests () {
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
    echo "bad_date_type.csv didn't import with failure"
    exit 1
  fi
  
  
  cleanup_collection "number_type"
  $FAUNA_CMD import --endpoint data-import-test --type=age::number --path=oss-926/number_type.csv
  if [ $? != 0 ];then
    echo "number_type.csv didn't import with success"
    exit 1
  fi
  
  cleanup_collection "bad_number_type"
  $FAUNA_CMD import --endpoint data-import-test --type=age::number --path=oss-926/bad_number_type.csv
  if [ $? == 0 ];then
    echo "bad_number_type.csv didn't import with failure"
    exit 1
  fi
}

short_row_tests () {
  cleanup_collection "short_rows"
  $FAUNA_CMD import --endpoint data-import-test --path=oss-985/short_rows.csv
  if [ $? == 0 ];then
    echo "short_rows.csv should have failed to import without the --allow-short-rows flag"
    exit 1
  fi
  
  $FAUNA_CMD import --endpoint data-import-test --allow-short-rows --path=oss-985/short_rows.csv
  if [ $? != 0 ];then
    echo "short_rows.csv import should have succeeded with --allow-short-rows flag"
    exit 1
  fi

  $FAUNA_CMD import --endpoint data-import-test --path=oss-985/too_long_row.csv
  if [ $? == 0 ];then
    echo "too_long_row.csv should have failed to import due to having too many columns."
    exit 1
  fi

}

# Comment out test batches as required.
run_type_tests
short_row_tests

echo "--------------------------------------------------"
echo "ALL SCRAPPY TESTS PASSED!!"
