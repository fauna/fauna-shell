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
  

  $FAUNA_CMD eval --stdin --endpoint data-import-test &> /dev/null << CMD
    If(
      Exists(Collection("$COLLECTION")),
      Map(
        Paginate(Documents(Collection("$COLLECTION"))),
        Lambda("X",Delete(Var("X")))
      ),
      "$COLLECTION does not exist. Import job will create it"
    )
CMD
}

fail_test() {
    MESSAGE=$1
    echo "\033[31m TEST FAILED: $MESSAGE \033[0m" >&2
    exit 1
}

run_type_tests () {
  cleanup_collection "bool_type"
  $FAUNA_CMD import --endpoint data-import-test --type=favorite::bool --path=oss-926/bool_type.csv
  if [ $? != 0 ];then
    fail_test "bool_type.csv didn't import with success"
  fi
  
  cleanup_collection "date_type"
  $FAUNA_CMD import --endpoint data-import-test --type=birthday::date --path=oss-926/date_type.csv
  if [ $? != 0 ];then
    fail_test "date_type.csv didn't import with success"
  fi
  
  cleanup_collection "bad_date_type"
  $FAUNA_CMD import --endpoint data-import-test --type=birthday::date --path=oss-926/bad_date_type.csv
  if [ $? == 0 ];then
    fail_test "bad_date_type.csv didn't import with failure"
  fi
  
  
  cleanup_collection "number_type"
  $FAUNA_CMD import --endpoint data-import-test --type=age::number --path=oss-926/number_type.csv
  if [ $? != 0 ];then
    fail_test "number_type.csv didn't import with success"
  fi
  
  cleanup_collection "bad_number_type"
  $FAUNA_CMD import --endpoint data-import-test --type=age::number --path=oss-926/bad_number_type.csv
  if [ $? == 0 ];then
    fail_test "bad_number_type.csv didn't import with failure"
  fi
}

short_row_tests () {
  cleanup_collection "short_rows"
  $FAUNA_CMD import --endpoint data-import-test --path=oss-985/short_rows.csv
  if [ $? == 0 ];then
    fail_test "short_rows.csv should have failed to import without the --allow-short-rows flag"
  fi
  
  $FAUNA_CMD import --endpoint data-import-test --allow-short-rows --path=oss-985/short_rows.csv
  if [ $? != 0 ];then
    fail_test "short_rows.csv import should have succeeded with --allow-short-rows flag"
  fi

  cleanup_collection "short_rows_with_type_translations"
  $FAUNA_CMD import --endpoint data-import-test --allow-short-rows --type=number::number --type=date::date --type=boolean::bool --path=oss-985/short_rows_with_type_translations.csv
  if [ $? != 0 ];then
    fail_test "short_rows_with_type_translations.csv import should have succeeded with --allow-short-rows flag"
  fi

  $FAUNA_CMD import --endpoint data-import-test --path=oss-985/too_long_row.csv
  if [ $? == 0 ];then
    fail_test "too_long_row.csv should have failed to import due to having too many columns."
  fi

}

# Comment out test batches as required.
run_type_tests
short_row_tests

echo "--------------------------------------------------"
echo "ALL SCRAPPY TESTS PASSED!!"
