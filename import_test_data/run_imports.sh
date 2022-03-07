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
  $FAUNA_CMD import --endpoint data-import-test --type=favorite::bool --path=type_tests/bool_type.csv
  if [ $? != 0 ];then
    fail_test "bool_type.csv didn't import with success"
  fi
  
  cleanup_collection "date_type"
  $FAUNA_CMD import --endpoint data-import-test --type=birthday::date --path=type_tests/date_type.csv
  if [ $? != 0 ];then
    fail_test "date_type.csv didn't import with success"
  fi
  
  cleanup_collection "bad_date_type"
  $FAUNA_CMD import --endpoint data-import-test --type=birthday::date --path=type_tests/bad_date_type.csv
  if [ $? == 0 ];then
    fail_test "bad_date_type.csv didn't import with failure"
  fi
  
  
  cleanup_collection "number_type"
  $FAUNA_CMD import --endpoint data-import-test --type=age::number --path=type_tests/number_type.csv
  if [ $? != 0 ];then
    fail_test "number_type.csv didn't import with success"
  fi
  
  cleanup_collection "bad_number_type"
  $FAUNA_CMD import --endpoint data-import-test --type=age::number --path=type_tests/bad_number_type.csv
  if [ $? == 0 ];then
    fail_test "bad_number_type.csv didn't import with failure"
  fi

  cleanup_collection "auto_type_translation"
  $FAUNA_CMD import --endpoint data-import-test --type=age::number --path=type_tests/auto_type_translation.csv
  if [ $? == 1 ];then
    fail_test "auto_type_translation.csv didn't import with success"
  fi
}

short_row_tests () {
  cleanup_collection "short_rows"
  $FAUNA_CMD import --endpoint data-import-test --path=csv_row_len_tests/short_rows.csv
  if [ $? == 0 ];then
    fail_test "short_rows.csv should have failed to import without the --allow-short-rows flag"
  fi
  
  cleanup_collection "short_rows"
  $FAUNA_CMD import --endpoint data-import-test --allow-short-rows --path=csv_row_len_tests/short_rows.csv
  if [ $? != 0 ];then
    fail_test "short_rows.csv import should have succeeded with --allow-short-rows flag"
  fi

  cleanup_collection "short_rows_with_type_translations"
  $FAUNA_CMD import --endpoint data-import-test --allow-short-rows --type=number::number --type=date::date --type=boolean::bool --path=csv_row_len_tests/short_rows_with_type_translations.csv
  if [ $? != 0 ];then
    fail_test "short_rows_with_type_translations.csv import should have succeeded with --allow-short-rows flag"
  fi

  cleanup_collection "too_long_rows"
  $FAUNA_CMD import --endpoint data-import-test --path=csv_row_len_tests/too_long_row.csv
  if [ $? == 0 ];then
    fail_test "too_long_row.csv should have failed to import due to having too many columns."
  fi

}

header_name_tests () {
  cleanup_collection "headers"
  $FAUNA_CMD import --endpoint data-import-test --path=header_tests/headers.csv
  if [ $? != 0 ];then
    fail_test "headers.csv failed to import"
  fi

  cleanup_collection "alt_char_headers"
  $FAUNA_CMD import --endpoint data-import-test --path=header_tests/alt_char_headers.csv
  if [ $? != 0 ];then
    fail_test "alt_char_headers.csv failed to import"
  fi

}

# Comment out test batches as required.
run_type_tests
short_row_tests
header_name_tests

echo "--------------------------------------------------"
echo "ALL SCRAPPY TESTS PASSED!!"
