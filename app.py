from flask import Flask, request, jsonify, render_template
from solver import simplify

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/simplify', methods=['POST'])
def simplify_route():
    data = request.get_json()
    minterms = data.get('minterms', [])
    dont_cares = data.get('dont_cares', [])
    return jsonify(simplify(minterms, dont_cares))


def main():
    app.run(host='0.0.0.0', port=5000, debug=True)


if __name__ == '__main__':
    main()
