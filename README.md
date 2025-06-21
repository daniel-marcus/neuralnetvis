# NeuralNetVis

Wrap your head around neural networks and watch machines learning: NeuralNetVis is a platform for visualizing and exploring neural networks in your browser. Built with [TensorFlow.js](https://github.com/tensorflow/tfjs) and [three.js](https://github.com/mrdoob/three.js).

Live here: [https://neuralnetvis.app](https://neuralnetvis.app)

## Performance

This is a prototype under development which is not yet optimized for mobile devices. It runs best on desktop browsers with WebGPU support (e.g. Chrome) which allows a direct data transfer on the GPU between the TensorFlow.js inference backend and the three.js rendering backend.

## Datasets

These datasets are available at the moment; most of them are smaller subsets of the original datasets to keep network load and memory usage reasonable.

| Name                                                                    | Description             | Task                 | Features | Train samples | Test samples |
| :---------------------------------------------------------------------- | :---------------------- | :------------------- | -------: | ------------: | -----------: |
| [MNIST](https://en.wikipedia.org/wiki/MNIST_database)                   | Handwritten digits      | Classification (10)  |  28x28x1 |        20,000 |        2,000 |
| [Fashion MNIST](https://github.com/zalandoresearch/fashion-mnist)       | Clothing items          | Classification (10)  |  28x28x1 |        20,000 |        2,000 |
| [CIFAR10](https://www.cs.toronto.edu/~kriz/cifar.html)                  | Colored images          | Classification (10)  |  32x32x3 |        18,000 |        1,800 |
| [CIFAR100](https://www.cs.toronto.edu/~kriz/cifar.html)                 | Colored images          | Classification (100) |  32x32x3 |        18,000 |        1,800 |
| [Auto MPG](https://archive.ics.uci.edu/dataset/9/auto+mpg)              | Predict fuel efficiency | Regression           |        9 |           314 |           50 |
| [California Housing](https://keras.io/api/datasets/california_housing/) | Predict housing prices  | Regression           |        8 |        16,512 |        4,128 |
| [IMDb](https://ai.stanford.edu/~amaas/data/sentiment/)                  | Sentiment analysis      | Classification (2)   |      200 |        25,000 |       25,000 |

## Models

The app comes with a pretrained model for each of the above mentioned datasets. Other models:

- [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker): Detects coordinates of 21 landmarks for each hand which can be used for hand pose classifications with webcam input
- [MobileNetV2](https://keras.io/api/applications/mobilenet/#mobilenetv2-function): Google's MobileNetV2 for image classification, trained on ImageNet data (224x224x3)

### Model Import (experimental)

Custom pretrained models from Python Tensorflow can be imported in the _my models_ section. Notes:

- Only _LayersModel_ models are supported
- For Keras 3.x, use `model.save('model.keras')` to export the model
- For Keras 2.x, use [tfjs-converter](https://github.com/tensorflow/tfjs/tree/master/tfjs-converter): `tfjs.converters.save_keras_model(model, './export/')`

## Folder Structure

```
├── public              # assets: datasets, fonts, images and TensorFlow's WebAssembly backend
├── src
│   └── app/            # layout and pages for the Next.js App Router
│   └── components/     # main UI components: header, menu, tile grid, status bar, etc.
│   └── contents/       # lessons and specific UI elements for lessons
│   └── data/           # dataset definitions and all logic related to loading and storing datasets
│   └── model/          # everything related to TensorFlow.js and ML: model creation, training, activations, weights and biases
│   └── neuron-layers/  # here is where internal layer and neuron representations are generated for a given model
│   └── scene-views/    # 3d-model rendering with three.js, evaluation view, deck.gl map and other scene-specific components
│   └── store/          # a global Zustand store for UI settings and scoped stores for every scene
│   └── utils/          # everything else
```

## Resources, Inspirations, and Credits

- [Stanford University CS231n – Deep Learning for Computer Vision](https://cs231n.github.io): A great resource for all the theory behind this project
- [An Interactive Node-Link Visualization of Convolutional Neural Networks](https://adamharley.com/nn_vis/) by Adam W. Harley
- TensorFlow's [Neural Network Playground](https://playground.tensorflow.org/)
- Google's [Teachable Machine](https://teachablemachine.withgoogle.com)
- The logo and the lesson headings use a modified version of the _BlurVision ASCII_ font by Aiden Neuding using patorjk's [figlet.js](https://github.com/patorjk/figlet.js) for ASCII Art

```
▓████████▓   ▓█▓    ▓█▓    ▓██████▓    ▓███████▓    ▓█▓    ▓█▓    ▓███████▓   ▓█▓
   ▓█▓       ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓          ▓█▓
   ▓█▓       ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓          ▓█▓
   ▓█▓       ▓████████▓   ▓████████▓   ▓█▓    ▓█▓   ▓███████▓     ▓██████▓    ▓█▓
   ▓█▓       ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓          ▓█▓   ▓█▓
   ▓█▓       ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓          ▓█▓
   ▓█▓       ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓███████▓    ▓█▓
```
