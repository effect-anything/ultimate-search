console.log("OK");
function test() {
  console.log("1");

  function inner() {
    throw new Error("OK");
    return "OK";
  }

  inner();
}

test();
