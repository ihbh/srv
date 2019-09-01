# rpc-test Users.GetDetails '[123,456]'
# rpc-test Users.SetDetails '{"name":"Joe"}'
rpc-test() {
  curl -v -H 'Authorization: {"uid":"1234567812345678"}' \
    -X POST -d $2 localhost:3921/rpc/$1;
}
