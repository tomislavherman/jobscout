package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/joho/godotenv"
)

func main() {
	secretBytes := make([]byte, 32)
	if _, err := rand.Read(secretBytes); err != nil {
		fatalf("generate secret: %v", err)
	}
	secret := base64.RawURLEncoding.EncodeToString(secretBytes)

	envPath := "../.env"
	if len(os.Args) > 1 {
		envPath = os.Args[1]
	}

	if err := writeEnvVar(envPath, "JWT_SECRET", secret); err != nil {
		fatalf("write .env: %v", err)
	}

	fmt.Printf("JWT_SECRET written to %s\n", envPath)
}

func writeEnvVar(path, key, value string) error {
	godotenv.Load(path)

	data, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	re := regexp.MustCompile(`(?m)^` + key + `=.*$`)
	line := key + "=" + value
	var output string
	if re.Match(data) {
		output = re.ReplaceAllString(string(data), line)
	} else {
		output = strings.TrimRight(string(data), "\n") + "\n" + line + "\n"
	}

	return os.WriteFile(path, []byte(output), 0600)
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
