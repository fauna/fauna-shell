#! /bin/sh
# To run setup your ~/.fauna-shell to include a data-import-test section
# that points to the fauna db instance you want to test (e.g. a local container)
# after setup, just run the script from this directory

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

ensure_db () {
  DB="$1"
  if [ -z "$DB" ]; then
    echo "missing db arg"
    exit 1
  fi
  

  $FAUNA_CMD eval --stdin --endpoint data-import-test &> /dev/null << CMD
    If(
      Exists(Database("db")),
      "Database exists!",
      CreateDatabase({name: "$DB"})
    )
CMD
}

cleanup_all_collections () {
  cleanup_collection "bool_type"
  cleanup_collection "date_type"
  cleanup_collection "bad_date_type"
  cleanup_collection "number_type"
  cleanup_collection "bad_number_type"
  cleanup_collection "auto_type_translation"
  cleanup_collection "default_null_inference"
  cleanup_collection "short_rows"
  cleanup_collection "short_rows_empty_strings"
  cleanup_collection "short_rows_with_type_translations"
  cleanup_collection "too_long_rows"
  cleanup_collection "headers"
  cleanup_collection "alt_char_headers"
  cleanup_collection "json_array"
  cleanup_collection "json_nested_type_trans"
  cleanup_collection "multi_array"
  cleanup_collection "mixed_array_and_l"
  cleanup_collection "json_l"
  cleanup_collection "mixed_l_and_array"
  cleanup_collection "foo"
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
  $FAUNA_CMD import --endpoint data-import-test --type=birthday::dateString --path=type_tests/date_type.csv
  if [ $? == 0 ];then
    fail_test "date_type.csv didn't fail"
  fi
  
  cleanup_collection "bad_date_type"
  $FAUNA_CMD import --endpoint data-import-test --type=birthday::dateString --path=type_tests/bad_date_type.csv
  if [ $? == 0 ];then
    fail_test "bad_date_type.csv succeeded"
  fi

  cleanup_collection "bad_date_type"
  $FAUNA_CMD import --endpoint data-import-test --type=birthday::dateString --path=type_tests/bad_date_type.csv --dry-run
  if [ $? == 0 ];then
    fail_test "bad_date_type.csv imported in dry-run mode should have failed"
  fi
    
  cleanup_collection "number_type"
  $FAUNA_CMD import --endpoint data-import-test --type=age::number --path=type_tests/number_type.csv
  if [ $? != 0 ];then
    fail_test "number_type.csv didn't import with success"
  fi

  cleanup_collection "bad_number_type"
  $FAUNA_CMD import --endpoint data-import-test --type=age::number --path=type_tests/bad_number_type.csv --dry-run
  if [ $? == 0 ];then
    fail_test "bad_number_type.csv imported in dry-run mode should have failed"
  fi
  
  cleanup_collection "bad_number_type"
  $FAUNA_CMD import --endpoint data-import-test --type=age::number --path=type_tests/bad_number_type.csv
  if [ $? == 0 ];then
    fail_test "bad_number_type.csv didn't fail"
  fi

  cleanup_collection "auto_type_translation"
  $FAUNA_CMD import --endpoint data-import-test --type=age::number --path=type_tests/auto_type_translation.csv
  if [ $? != 0 ];then
    fail_test "auto_type_translation.csv didn't import with success"
  fi

  cleanup_collection "default_null_inference"
  $FAUNA_CMD import --endpoint data-import-test --path=type_tests/default_null_inference.csv
  if [ $? != 0 ];then
    fail_test "default_null_inference.csv didn't import with success"
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

  cleanup_collection "short_rows_empty_strings"
  $FAUNA_CMD import --endpoint data-import-test --allow-short-rows --path=csv_row_len_tests/short_rows.csv --collection=short_rows_empty_strings --treat-empty-csv-cells-as=empty
  if [ $? != 0 ];then
    fail_test "short_rows.csv import into short_rows_empty_strings should have succeeded with --allow-short-rows and --treat-empty-csv-cells-as=emptyflag"
  fi

  cleanup_collection "short_rows_with_type_translations"
  $FAUNA_CMD import --endpoint data-import-test --allow-short-rows --type=number::number --type=date::dateString --type=boolean::bool --path=csv_row_len_tests/short_rows_with_type_translations.csv
  if [ $? == 0 ];then
    fail_test "short_rows_with_type_translations.csv import should have failed due to bad data"
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

json_tests () {
  cleanup_collection "json_array"
  $FAUNA_CMD import --endpoint data-import-test --path=json/json_array.json
  if [ $? != 0 ];then
    fail_test "json_array.json failed to import"
  fi

  cleanup_collection "json_nested_type_trans"
  $FAUNA_CMD import --endpoint data-import-test --path=json/json_nested_type_trans.json
  if [ $? != 0 ];then
    fail_test "json_nested_type_trans.json failed to import"
  fi

  cleanup_collection "multi_array"
  $FAUNA_CMD import --endpoint data-import-test --path=json/multi_array.json
  if [ $? != 0 ];then
    fail_test "multi_array.json failed to import"
  fi

  cleanup_collection "mixed_array_and_l"
  $FAUNA_CMD import --endpoint data-import-test --path=json/mixed_array_and_l.json
  if [ $? != 0 ];then
    fail_test "mixed_array_and_l.json failed to import"
  fi

  cleanup_collection "json_l"
  $FAUNA_CMD import --endpoint data-import-test --path=json/json_l.jsonl
  if [ $? != 0 ];then
    fail_test "json_l.jsonl failed to import"
  fi

  cleanup_collection "json_l"
  $FAUNA_CMD import --endpoint data-import-test --path=json/json_l.jsonl --type=blow.up.if::used
  if [ $? != 0 ];then
    fail_test "json_l.jsonl should have ignored type flags"
  fi

  cleanup_collection "mixed_l_and_array"
  $FAUNA_CMD import --endpoint data-import-test --path=json/mixed_l_and_array.json
  if [ $? != 0 ];then
    fail_test "mixed_l_and_array.json failed to import"
  fi
}

invalid_file_type_tests() {
  $FAUNA_CMD import --endpoint data-import-test --path=invalid_file_types/whatever.foo
  if [ $? == 0 ];then
    fail_test "whatever.foo should have failed to import but succeeded!"
  fi
}

directory_tests() {
  cleanup_all_collections
  $FAUNA_CMD import --endpoint data-import-test --path=json
  if [ $? != 0 ];then
    fail_test "directory should have succeeded"
  fi
  $FAUNA_CMD import --endpoint data-import-test --path=type_tests
  if [ $? != 0 ];then
    fail_test "directory should have succeeded"
  fi
  $FAUNA_CMD import --endpoint data-import-test --path=csv_row_len_tests
  if [ $? == 0 ];then
    fail_test "directory should have failed"
  fi
  $FAUNA_CMD import --endpoint data-import-test --path=header_tests
  if [ $? != 0 ];then
    fail_test "directory should have succeeded"
  fi
  $FAUNA_CMD import --endpoint data-import-test --path=invalid_file_types
  if [ $? == 0 ];then
    fail_test "directory should have failed"
  fi
  $FAUNA_CMD import --endpoint data-import-test --path=type_tests --collection=foo
}

directory_specify_collection_tests() {
  cleanup_collection "foo"
  $FAUNA_CMD import --endpoint data-import-test --path=type_tests --collection=foo
  if [ $? != 0 ];then
    fail_test "directory import should have succeeded"
  fi

  $FAUNA_CMD import --endpoint data-import-test --path=type_tests --collection=foo
  if [ $? == 0 ];then
    fail_test "directory import should have failed as collecion foo already exists"
  fi

  $FAUNA_CMD import --endpoint data-import-test --path=type_tests --collection=foo --append
  if [ $? != 0 ];then
    fail_test "directory import should have succeeded"
  fi
}

specify_db_tests() {
  cleanup_all_collections
  $FAUNA_CMD import --endpoint data-import-test --path=type_tests --db=Nope
  if [ $? == 0 ];then
    fail_test "directory import should have failed as db doesn't exist"
  fi

  cleanup_collection "json_array"
  $FAUNA_CMD import --endpoint data-import-test --path=json/json_array.json --db=Nope
  if [ $? == 0 ];then
      fail_test "json_array.json should have failed to import as db doesn't exist"
  fi

  cleanup_all_collections
  ensure_db "test-specify-db"
  $FAUNA_CMD import --endpoint data-import-test --path=type_tests --db=test-specify-db
  if [ $? != 0 ];then
    fail_test "directory should have succeeded"
  fi

  cleanup_collection "json_array"
  $FAUNA_CMD import --endpoint data-import-test --path=json/json_array.json --db=test-specify-db
  if [ $? != 0 ];then
    fail_test "json_array.json should have succeeded"
  fi
}

append_tests() {
  cleanup_collection "json_array"
  $FAUNA_CMD import --endpoint data-import-test --path=json/json_array.json
  if [ $? != 0 ];then
      fail_test "json_array.json failed to import initally"
  fi
 $FAUNA_CMD import --endpoint data-import-test --path=json/json_array.json
  if [ $? == 0 ];then
      fail_test "json_array.json should fail as the append flag was not sent"
  fi
  $FAUNA_CMD import --endpoint data-import-test --path=json/json_array.json --append
  if [ $? != 0 ];then
      fail_test "json_array.json failed to append"
  fi
  cleanup_collection "json_l"
  $FAUNA_CMD import --endpoint data-import-test --path=json/json_l.jsonl
  if [ $? != 0 ];then
    fail_test "json_l.jsonl failed to import initially"
  fi
  $FAUNA_CMD import --endpoint data-import-test --path=json/json_l.jsonl
  if [ $? == 0 ];then
    fail_test "json_l.jsonl should fail as the append flag was not sent"
  fi
  $FAUNA_CMD import --endpoint data-import-test --path=json/json_l.jsonl --append
  if [ $? != 0 ];then
    fail_test "json_l.jsonl failed to append"
  fi
  cleanup_collection "bool_type"
  $FAUNA_CMD import --endpoint data-import-test --type=favorite::bool --path=type_tests/bool_type.csv
  if [ $? != 0 ];then
    fail_test "bool_type.csv didn't import intially with success"
  fi
  $FAUNA_CMD import --endpoint data-import-test --type=favorite::bool --path=type_tests/bool_type.csv
  if [ $? == 0 ];then
    fail_test "bool_type.csv should fail as the append flag was not sent"
  fi
  $FAUNA_CMD import --endpoint data-import-test --type=favorite::bool --path=type_tests/bool_type.csv --append
  if [ $? != 0 ];then
    fail_test "bool_type.csv didn't failed to append"
  fi
}

# Comment out test batches as required.
run_type_tests
short_row_tests
header_name_tests
json_tests
invalid_file_type_tests
directory_tests
append_tests
directory_specify_collection_tests
specify_db_tests

echo "--------------------------------------------------"
echo "ALL SCRAPPY TESTS PASSED!!"
