attempt_counter=0
max_attempts=100

echo "waiting for $1"
until $(curl -m 1 --output /dev/null --silent --head --fail $1); do
  if [ ${attempt_counter} -eq ${max_attempts} ];then
    echo ""
    echo "Max attempts reached to $1"
    exit 1
  fi

  printf '.'
  attempt_counter=$(($attempt_counter+1))
  sleep 5
done
echo "$1 is up and running!"
